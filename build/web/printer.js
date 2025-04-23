function getPrinterVendorId() {
  // Common printer vendor IDs - add more as needed
  return [
    0x0483, 0x04b8, 0x0525, 0x0721, 0x0d3d, 0x1504, 0x154f, 0x1d90, 0x1fc9,
    0x2341, 0x6868 /* Added XP-236B-L VID */,
  ];
}

async function requestPrinter() {
  try {
    // First check if we already have access to any printers
    const devices = await navigator.usb.getDevices();
    if (devices.length > 0) {
      return devices[0];
    }

    // If no previously authorized devices, request access
    const filters = getPrinterVendorId().map((id) => ({ vendorId: id }));
    console.log("Requesting USB device with filters:", filters);

    const device = await navigator.usb.requestDevice({
      filters: filters,
    });
    console.log("Selected device:", device);
    return device;
  } catch (error) {
    console.error("Error selecting printer:", error);
    throw error;
  }
}

async function connectToPrinter(device) {
  try {
    console.log("Attempting to open device...");
    if (device.opened) {
      console.log("Device is already opened");
      return true;
    }

    await device.open();
    console.log("Device opened successfully");

    // Get the first configuration
    const configurationValue = device.configurations[0].configurationValue;
    await device.selectConfiguration(configurationValue);
    console.log("Configuration selected:", configurationValue);

    // Find the first interface and endpoint
    const interface = device.configuration.interfaces[0];
    const interfaceNumber = interface.interfaceNumber;
    await device.claimInterface(interfaceNumber);
    console.log("Interface claimed:", interfaceNumber);

    return true;
  } catch (error) {
    console.error("Error during connectToPrinter:", error);
    throw error;
  }
}

async function sendDataToPrinter(device, dataArray) {
  console.log("Sending data to printer:", device);
  if (!device || !dataArray) return false;
  try {
    // Endpoint 1 (OUT) is common, adjust if needed
    const endpointNumber = 1;
    console.log(
      `Transferring ${dataArray.length} bytes to endpoint ${endpointNumber}`
    );
    await device.transferOut(endpointNumber, dataArray);
    console.log("Data transferred");
    return true;
  } catch (error) {
    console.error("Error sending data to printer:", error);
    return false;
  }
}

function checkSecureContext() {
  if (!window.isSecureContext) {
    throw new Error(
      "USB access requires a secure context (HTTPS or localhost)"
    );
  }
}
