const express = require("express");
const cors = require("cors");
const escpos = require("escpos");
escpos.USB = require("escpos-usb");

const app = express();
app.use(cors()); // Allow requests from Flutter web app

// IMPORTANT: Verify these VID/PID values match your specific printer!
// Find them using Device Manager (Windows) or lsusb (Linux/macOS).
// The values below are examples (Epson TM-T20II series often use 0x04b8 / 0x0202).
// The user provided 0x04b8 / 0x0e15, which might be for an XP-236B-L. Please confirm.
const PRINTER_VID = 0x1e3;
const PRINTER_PID = 0x166f; // Make sure this is correct for YOUR printer

let device = null;
let printer = null;
let isConnecting = false;
let connectionError = null;

// Middleware to parse raw request body for print data
// Increase limit if needed for large print jobs
app.use(
  "/print",
  express.raw({ type: "application/octet-stream", limit: "10mb" })
);

// Attempt to connect (or reconnect) to the printer
function connectPrinter(callback) {
  if (printer && device?.device) {
    // Check if already connected
    console.log("Printer already seems connected.");
    if (callback) callback(null); // Indicate success (already connected)
    return;
  }
  if (isConnecting) {
    console.log("Connection attempt already in progress.");
    if (callback) callback(new Error("Connection attempt in progress."));
    return;
  }

  console.log(
    `Attempting to connect to printer VID=${PRINTER_VID}, PID=${PRINTER_PID}...`
  );
  isConnecting = true;
  connectionError = null; // Reset error state

  try {
    // Ensure previous device instance is properly handled if necessary
    if (device) {
      // Attempt to close previous device cleanly, ignore errors
      try {
        device.close(() => {});
      } catch (closeErr) {
        console.warn("Error closing previous device:", closeErr.message);
      }
      device = null;
      printer = null;
    }

    device = new escpos.USB(PRINTER_VID, PRINTER_PID);
    printer = new escpos.Printer(device);

    device.open((error) => {
      isConnecting = false; // Finished connection attempt
      if (error) {
        connectionError = error;
        console.error("Printer connection failed:", error);
        // Clean up partially initialized objects on failure
        device = null;
        printer = null;
        if (callback) callback(error);
      } else {
        console.log("Printer connected successfully!");
        if (callback) callback(null); // Signal success
      }
    });
  } catch (initError) {
    isConnecting = false; // Finished connection attempt (exception case)
    connectionError = initError;
    console.error("Printer initialization error:", initError);
    device = null;
    printer = null;
    if (callback) callback(initError);
  }
}

// Endpoint to handle print requests
app.post("/print", (req, res) => {
  console.log(`Received /print request (${req.body.length} bytes)`);

  const printData = req.body; // Raw bytes from Flutter app

  if (!printData || printData.length === 0) {
    return res
      .status(400)
      .json({ success: false, error: "No print data received." });
  }

  // Check connection status and attempt to connect if needed
  if (!printer || !device?.device || connectionError) {
    console.log(
      "Printer not connected or in error state. Attempting connection..."
    );
    connectPrinter((connectErr) => {
      if (connectErr) {
        return res
          .status(500)
          .json({
            success: false,
            error: `Printer connection failed: ${connectErr.message}`,
          });
      }
      // Proceed with printing after successful connection
      sendRawData(printData, res);
    });
  } else {
    // Already connected, proceed with printing
    sendRawData(printData, res);
  }
});

// Function to send raw data to the printer
function sendRawData(data, res) {
  if (!printer || !device) {
    return res
      .status(500)
      .json({
        success: false,
        error: "Printer object not available after connection attempt.",
      });
  }
  try {
    // Use device.write directly for raw data
    device.write(data, (writeErr) => {
      if (writeErr) {
        console.error("Error writing raw data to printer:", writeErr);
        // Attempt to close and signal error - might need reconnect next time
        try {
          device.close(() => {});
        } catch (e) {}
        printer = null; // Mark as disconnected
        device = null;
        connectionError = writeErr;
        return res
          .status(500)
          .json({
            success: false,
            error: `Failed to write data: ${writeErr.message}`,
          });
      } else {
        console.log("Raw data sent successfully.");
        // Optional: Keep connection open or close after each print?
        // For now, keeping it open. Closing would look like:
        // device.close(() => {
        //   console.log('Printer closed after print.');
        //   printer = null;
        //   device = null;
        //   res.status(200).json({ success: true });
        // });
        return res.status(200).json({ success: true });
      }
    });
  } catch (e) {
    console.error("Exception during device.write:", e);
    return res
      .status(500)
      .json({ success: false, error: `Exception sending data: ${e.message}` });
  }
}

// Endpoint to check printer status
app.get("/status", (req, res) => {
  if (isConnecting) {
    return res.status(200).json({ status: "connecting" });
  }
  if (connectionError) {
    return res
      .status(200)
      .json({ status: "error", message: connectionError.message });
  }
  if (printer && device?.device) {
    return res.status(200).json({ status: "connected" });
  }
  return res.status(200).json({ status: "disconnected" });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
   connectPrinter(); // Initial connection attempt on startup
});

process.on("SIGINT", () => {
  console.log("Caught interrupt signal");
  if (device) {
    device.close(() => {
      console.log("Printer closed.");
      process.exit();
    });
  } else {
    process.exit();
  }
});
