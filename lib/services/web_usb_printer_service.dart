// ignore_for_file: avoid_web_libraries_in_flutter, unused_element

import 'dart:async';
import 'dart:js_util'; // For promiseToFuture
import 'dart:typed_data';

import 'package:js/js.dart';
import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';

// Define JS bindings for the functions in printer.js
@JS()
external Future<dynamic>
    requestPrinter(); // Returns a JSObject (the USBDevice) or null

@JS()
external Future<bool> connectToPrinter(dynamic device);

@JS()
external Future<bool> sendDataToPrinter(dynamic device, Uint8List dataArray);

class WebUsbPrinterService {
  dynamic _device; // To store the JS USBDevice object

  Future<bool> requestPrinter() async {
    print("WebUsbPrinterService: Requesting printer...");
    try {
      _device = await promiseToFuture(requestPrinter());
      if (_device != null) {
        print("WebUsbPrinterService: Device selected, connecting...");
        bool connected = await promiseToFuture(connectToPrinter(_device));
        print("WebUsbPrinterService: Connection attempt result: $connected");
        return connected;
      } else {
        print("WebUsbPrinterService: No printer selected or request failed.");
        return false;
      }
    } catch (e) {
      print(
          "WebUsbPrinterService: Error during printer request/connection: $e");
      _device = null; // Ensure device is null on error
      return false;
    }
  }

  Future<bool> printBarcode(String data) async {
    if (_device == null) {
      print("WebUsbPrinterService: Printer not connected.");
      return false;
    }
    print("WebUsbPrinterService: Printing barcode for data: $data");
    try {
      // Generate ESC/POS commands using esc_pos_utils_plus
      print("  Generating ESC/POS commands...");
      final profile = await CapabilityProfile.load(); // Or specify a profile
      final generator = Generator(PaperSize.mm80, profile);
      List<int> bytes = [];

      bytes += generator.reset();
      bytes += generator.text('Barcode via package:js:\n'); // Added newline
      bytes += generator.feed(1);
      // Note: Barcode height/width setting might need different methods in esc_pos_utils_plus
      // Convert String data to List<int> for barcode generation
      final barcodeDataBytes = data.codeUnits;
      bytes += generator.barcode(Barcode.code128(barcodeDataBytes));
      bytes += generator.feed(2);
      bytes += generator.cut();

      final commands = Uint8List.fromList(bytes);
      print("  Commands generated (${commands.length} bytes)");

      // Send the commands to the printer via JS interop
      print("  Sending data to printer...");
      bool success =
          await promiseToFuture(sendDataToPrinter(_device, commands));
      print("WebUsbPrinterService: Send data result: $success");
      return success;
    } catch (e) {
      print("WebUsbPrinterService: Error generating or sending print data: $e");
      return false;
    }
  }
}
