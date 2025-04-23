import 'package:flutter/material.dart';
import 'services/web_usb_printer.dart';

class WebPrinterScreen extends StatefulWidget {
  // Add const constructor
  const WebPrinterScreen({super.key});

  @override
  // Add explicit return type
  State<WebPrinterScreen> createState() => _WebPrinterScreenState();
}

class _WebPrinterScreenState extends State<WebPrinterScreen> {
  final WebUsbPrinterService _printerService = WebUsbPrinterService();
  bool _isPrinterConnected = false;
  bool _isConnecting = false; // Add state for connection process
  bool _isPrinting = false; // Add state for printing process

  Future<void> _connectPrinter() async {
    print("_connectPrinter started");
    setState(() => _isConnecting = true);
    bool connected = await _printerService.requestPrinter();
    if (!mounted) return; // Check if widget is still mounted
    setState(() {
      _isPrinterConnected = connected;
      _isConnecting = false;
    });
    print("_connectPrinter finished: connected=$connected");

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(connected
            ? 'Printer connected successfully'
            : 'Failed to connect printer'),
        backgroundColor: connected ? Colors.green : Colors.red,
      ),
    );
  }

  Future<void> _printBarcode() async {
    print("_printBarcode started");
    if (!_isPrinterConnected) {
      print("  Printer not connected");
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please connect a printer first')),
      );
      return;
    }

    setState(() => _isPrinting = true);
    const String barcodeData = '123456789'; // Data to print
    print("  Printing barcode data: $barcodeData");
    bool printed = await _printerService.printBarcode(barcodeData);
    if (!mounted) return; // Check if widget is still mounted
    setState(() => _isPrinting = false);
    print("_printBarcode finished: printed=$printed");

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(printed
            ? 'Barcode printed successfully'
            : 'Failed to print barcode'),
        backgroundColor: printed ? Colors.green : Colors.red,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    print(
        "_WebPrinterScreenState build executed (connected=$_isPrinterConnected, connecting=$_isConnecting, printing=$_isPrinting)");
    return Scaffold(
      appBar: AppBar(
          title: const Text('Web USB Printer (package:js)')), // Added const
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ElevatedButton(
              // Disable button while connecting or if already connected
              onPressed:
                  _isConnecting || _isPrinterConnected ? null : _connectPrinter,
              child: Text(_isPrinterConnected
                  ? 'Connected ✓'
                  : (_isConnecting ? 'Connecting...' : 'Connect Printer')),
            ),
            const SizedBox(height: 20), // Added const
            ElevatedButton(
              // Disable button while printing or if not connected
              onPressed:
                  _isPrinterConnected && !_isPrinting ? _printBarcode : null,
              child: Text(_isPrinting ? 'Printing...' : 'Print Barcode'),
            ),
          ],
        ),
      ),
    );
  }
}
