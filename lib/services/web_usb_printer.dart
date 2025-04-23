import 'dart:js_util';
import 'package:js/js.dart';
import 'dart:html' as html;

class WebUsbPrinterService {
  dynamic _printer;

  Future<bool> requestPrinter() async {
    try {
      // Check if running on web
      if (!html.window.navigator.userAgent.contains('Mozilla')) {
        throw Exception('USB printing is only supported on web browsers');
      }

      // Request printer access
      _printer =
          await promiseToFuture(callMethod(html.window, 'requestPrinter', []));

      // Connect to the printer
      await promiseToFuture(
          callMethod(html.window, 'connectToPrinter', [_printer]));

      return true;
    } catch (e) {
      print('Error accessing printer: $e');
      return false;
    }
  }

  Future<bool> printBarcode(String barcodeData) async {
    if (_printer == null) {
      return false;
    }

    try {
      // Example ESC/POS commands for barcode printing
      // Modify these according to your printer's command set
      List<int> commands = [
        0x1D, 0x68, 0x50, // Set barcode height
        0x1D, 0x77, 0x02, // Set barcode width
        0x1D, 0x6B, 0x04 // Print barcode type (Code39)
      ];

      // Add barcode data
      commands.addAll(barcodeData.codeUnits);
      commands.add(0x00); // Terminate barcode data

      // Add line feed
      commands.addAll([0x0A, 0x0A]);

      // Convert commands to string for JS
      String data = String.fromCharCodes(commands);

      // Send data to printer
      await promiseToFuture(
          callMethod(html.window, 'sendDataToPrinter', [_printer, data]));

      return true;
    } catch (e) {
      print('Error printing barcode: $e');
      return false;
    }
  }
}
