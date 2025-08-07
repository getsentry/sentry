# Seer Similarity Service Integration

This module handles communication with the Seer service for ML-powered issue similarity detection and grouping.

## Device Error Handling

### Issue
The Seer service occasionally encounters "RuntimeError: Invalid device" errors when its ML models attempt to use GPU devices that are unavailable or misconfigured in the deployment environment. These errors can cause request failures and impact the grouping functionality.

### Root Cause
The error occurs when:
- PyTorch models in Seer try to use a specific GPU device (e.g., "cuda:0") that doesn't exist
- GPU drivers are not properly installed or configured
- The specified GPU device is busy or unavailable
- There's a mismatch between the expected GPU configuration and the actual hardware

### Solution
Enhanced error handling has been implemented to:

1. **Detect Device Errors**: Added `_is_device_error()` function that identifies device-related error messages in Seer responses
2. **Circuit Breaker Integration**: Device errors now trigger the circuit breaker mechanism to prevent cascading failures
3. **Improved Logging**: Device errors are logged with specific context and error type for better debugging
4. **Graceful Degradation**: When device errors occur, the service fails gracefully rather than crashing

### Error Patterns Detected
The system now detects these error patterns in Seer responses:
- "Invalid device"
- "RuntimeError: Invalid device" 
- "device not available"
- "CUDA device"
- "GPU device"

### Monitoring
Device errors are tracked with specific metrics tags:
- `error_type: "device_error"` in metrics
- Dedicated log messages with `error_type: "device_error"`
- Circuit breaker activation for device-related failures

### Implementation Details
Device error handling is implemented in:
- `src/sentry/seer/similarity/similar_issues.py`: Enhanced `get_similarity_data_from_seer()`
- `src/sentry/seer/similarity/grouping_records.py`: Enhanced record management functions

This ensures that ML model device issues in the Seer service don't impact Sentry's core functionality, with automatic fallback through the circuit breaker mechanism.