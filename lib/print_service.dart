import 'dart:typed_data';
import 'package:http/http.dart' as http;

class PrintService {
  // URL of the Node.js backend server
  static const String _printUrl = 'http://localhost:5000';

  /// Sends raw ESC/POS command bytes to the backend server.
  static Future<bool> sendPrintRequest(Uint8List commandBytes) async {
    print("PrintService: Sending ${commandBytes.length} bytes to $_printUrl");
    if (commandBytes.isEmpty) {
      print("PrintService Error: No command bytes to send.");
      return false;
    }

    try {
      final response = await http.post(
        Uri.parse(_printUrl),
        headers: {
          // Let the server know we're sending raw bytes
          'Content-Type': 'application/octet-stream',
        },
        body: commandBytes, // Send the bytes directly
      );

      print("PrintService: Response Status Code: ${response.statusCode}");
      print("PrintService: Response Body: ${response.body}");

      // Consider success only if the server returns 200 OK
      if (response.statusCode == 200) {
        // Optionally check the body for { success: true } if the server sends it
        // final responseBody = jsonDecode(response.body);
        // return responseBody['success'] == true;
        return true;
      } else {
        print(
            "PrintService Error: Server returned status ${response.statusCode}");
        return false;
      }
    } catch (e) {
      // Handle network errors, server down, CORS issues (if any), etc.
      print('PrintService Error: Failed to send print request: $e');
      return false;
    }
  }
}
