// This file (web/printer_interop.js) handles WebUSB communication

// Global variable to hold the device instance
let usbPrinterDevice = null;
let usbPrinterInterface = null;
let usbPrinterEndpoint = null;

// Helper to store last connected device info
const storeDeviceDetails = (device) => {
  if (device) {
    localStorage.setItem(
      "usbPrinterDetails",
      JSON.stringify({
        vendorId: device.vendorId,
        productId: device.productId,
        productName: device.productName, // Store name for potential display
      })
    );
  } else {
    localStorage.removeItem("usbPrinterDetails");
  }
};

// Helper to retrieve stored device info
const getStoredDeviceDetails = () => {
  const details = localStorage.getItem("usbPrinterDetails");
  return details ? JSON.parse(details) : null;
};

/**
 * Lists USB devices the user has previously granted permission to.
 * Does NOT actively scan for new devices.
 */
async function getPermittedUsbDevices() {
  try {
    const devices = await navigator.usb.getDevices();
    console.log("Permitted devices:", devices);
    return devices.map((device) => ({
      vendorId: device.vendorId,
      productId: device.productId,
      productName: device.productName,
      serialNumber: device.serialNumber, // Include serial number if available
    }));
  } catch (error) {
    console.error("Error getting permitted USB devices:", error);
    return []; // Return empty list on error
  }
}

/**
 * Requests the user select a USB printer device and connects to it.
 * Stores connection details on success.
 */
async function requestUsbPrinter() {
  // Close any existing connection first
  if (usbPrinterDevice) {
    await closeUsbPrinter();
  }

  try {
    // Request device selection from the user.
    // Filters can be added here, e.g., { vendorId: 0x1234 } or class codes for printers
    // Common printer interface class code is 7
    const device = await navigator.usb.requestDevice({
      filters: [{ classCode: 7, subclassCode: 1 }],
    });
    console.log("Device selected:", device);

    await device.open();
    console.log("Device opened.");

    // Select the first configuration (usually there's only one)
    await device.selectConfiguration(1);
    console.log("Configuration selected.");

    // Find the printer interface (usually interface 0 for printers)
    // This might need adjustment based on the specific printer.
    let ifaceNumber = -1;
    let endpointNumber = -1;

    for (const iface of device.configuration.interfaces) {
      for (const alt of iface.alternates) {
        // Check if this interface implements the printer class
        if (alt.interfaceClass === 7 && alt.interfaceSubclass === 1) {
          ifaceNumber = iface.interfaceNumber;
          // Find the OUT endpoint (direction: "out")
          for (const ep of alt.endpoints) {
            if (ep.direction === "out") {
              endpointNumber = ep.endpointNumber;
              break; // Found OUT endpoint
            }
          }
          break; // Found printer interface alternate
        }
      }
      if (ifaceNumber !== -1) break; // Found interface and endpoint
    }

    if (ifaceNumber === -1 || endpointNumber === -1) {
      throw new Error(
        "Could not find a suitable printer interface or endpoint."
      );
    }

    console.log(`Claiming interface ${ifaceNumber}...`);
    await device.claimInterface(ifaceNumber);
    console.log(`Interface ${ifaceNumber} claimed.`);

    // Store device, interface, and endpoint globally
    usbPrinterDevice = device;
    usbPrinterInterface = ifaceNumber; // Store the interface number
    usbPrinterEndpoint = endpointNumber; // Store the endpoint number

    // Store connection details
    storeDeviceDetails(usbPrinterDevice);

    console.log("WebUSB Printer connected:", usbPrinterDevice.productName);
    return {
      // Return success and device info
      success: true,
      vendorId: usbPrinterDevice.vendorId,
      productId: usbPrinterDevice.productId,
      productName: usbPrinterDevice.productName,
    };
  } catch (error) {
    console.error("Error requesting WebUSB device:", error);
    // Clear stored details on failure to connect
    storeDeviceDetails(null);
    // Ensure globals are reset
    usbPrinterDevice = null;
    usbPrinterInterface = null;
    usbPrinterEndpoint = null;
    return { success: false, error: error.message }; // Return failure indication
  }
}

// Function to send data to the printer
async function sendDataToUsbPrinter(data) {
  if (!usbPrinterDevice || !usbPrinterEndpoint) {
    console.error("Printer not connected or endpoint not found.");
    return false;
  }
  try {
    // Data needs to be a Uint8Array or ArrayBuffer
    const dataBuffer = new Uint8Array(data);
    console.log(
      `Sending ${dataBuffer.length} bytes to endpoint ${usbPrinterEndpoint}`
    );
    // Transfer data to the stored endpoint
    const result = await usbPrinterDevice.transferOut(
      usbPrinterEndpoint, // Use the stored endpoint number
      dataBuffer
    );
    console.log("Data sent:", result);
    return { success: true, bytesWritten: result.bytesWritten }; // Indicate success
  } catch (error) {
    console.error("Error sending data:", error);
    // Attempt to close on error? Maybe connection lost.
    // await closeUsbPrinter(); // Consider if auto-close on error is desired
    return { success: false, error: error.message }; // Indicate failure
  }
}

/**
 * Closes the connection to the USB printer.
 */
async function closeUsbPrinter() {
  if (!usbPrinterDevice) {
    console.log("No device connected to close.");
    return;
  }
  try {
    if (usbPrinterInterface !== null) {
      console.log(`Releasing interface ${usbPrinterInterface}...`);
      // Check if device is still open before trying to release
      if (usbPrinterDevice.opened) {
        await usbPrinterDevice.releaseInterface(usbPrinterInterface);
        console.log("Interface released.");
      } else {
        console.log("Device already closed, cannot release interface.");
      }
      usbPrinterInterface = null;
      usbPrinterEndpoint = null; // Also clear endpoint
    }
    // Check again if device is open before closing
    if (usbPrinterDevice.opened) {
      await usbPrinterDevice.close();
      console.log("Device closed.");
    } else {
      console.log("Device already closed.");
    }

    usbPrinterDevice = null;
    // Clear stored details on explicit close
    storeDeviceDetails(null);
  } catch (error) {
    console.error("Error closing WebUSB device:", error);
    // Force reset variables even if close fails
    usbPrinterDevice = null;
    usbPrinterInterface = null;
    usbPrinterEndpoint = null;
    storeDeviceDetails(null); // Ensure storage is cleared on error too
  }
}

// Make functions available globally for Flutter interop
window.printerInterop = {
  requestUsbPrinter: requestUsbPrinter,
  sendDataToUsbPrinter: sendDataToUsbPrinter,
  closeUsbPrinter: closeUsbPrinter,
  getPermittedUsbDevices: getPermittedUsbDevices, // Expose the new function
  getStoredDeviceDetails: getStoredDeviceDetails, // Expose helper to get stored details
};

console.log("printer_interop.js loaded with updated USB functions");
