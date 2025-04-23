import 'package:flutter/material.dart';
import 'package:bar_code_testing/web_printer_screen.dart'; // Import the new screen

void main() {
  print("main started");
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    print("MyApp.build executed");
    return const MaterialApp(
      home: WebPrinterScreen(), // Use the new screen
    );
  }
}

// Removed PrinterPage and _PrinterPageState classes
