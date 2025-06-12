# Log Observed Timestamp Research

## Summary

This document summarizes research into changing the observed timestamp for logs from the current time to the received time of the envelope in Sentry Relay.

## Current Implementation

### Frontend Display
- The frontend displays log timestamps using `sentry.observed_timestamp_nanos` field
- This is shown as "Received" time in the logs tooltip (`static/app/views/explore/logs/logsTimeTooltip.tsx`)
- The field maps to `OBSERVED_TIMESTAMP_PRECISE = 'sentry.observed_timestamp_nanos'` in the frontend constants

### Backend Processing Flow
- Events (including logs) go through the standard ingest processing pipeline
- The `start_time` field in envelope messages represents when Relay received the envelope from the SDK
- This is confirmed by the comment in `src/sentry/monitors/consumers/monitor_consumer.py:445`:
  ```python
  # XXX: The start_time is when relay received the original envelope store
  # request sent by the SDK.
  start_time = to_datetime(float(item.message["start_time"]))
  ```

### Problem Identification
Based on the research, the observed timestamp appears to be set to the current processing time rather than the envelope received time. This is problematic because:

1. **Processing delays**: There can be significant delays between when Relay receives an envelope and when it's processed
2. **Inaccurate timestamps**: Users see incorrect "received" times that don't reflect when Sentry actually received the log
3. **Debugging issues**: This makes it harder to debug timing issues in log ingestion

## Key Findings

### 1. Envelope Processing Architecture
- Logs are sent via the `log` envelope item type according to the Sentry Log protocol
- Envelopes contain a `start_time` field that represents when Relay received the envelope
- The processing pipeline extracts this `start_time` in `src/sentry/ingest/consumer/processors.py:104`

### 2. Similar Pattern in Spans
- Spans have a similar pattern with a `received` field that gets mapped to `sentry.received`
- This is visible in `src/sentry/spans/consumers/process_segments/convert.py:34` in the `FIELD_TO_ATTRIBUTE` mapping

### 3. Timestamp Enrichment Location
- Based on the documentation, Relay is responsible for enriching log data with additional attributes
- The observed timestamp enrichment likely happens in Relay rather than the backend Sentry processing

## Recommended Solution

### Location of Changes
The change should be made in **Relay** (the Rust component), not in the backend Python codebase. This is because:

1. Relay receives the envelopes and has access to the true received time
2. Relay is responsible for enriching log data with additional attributes
3. The backend processing happens asynchronously and may be delayed

### Implementation Approach
1. **Identify log processing in Relay**: Find where log envelope items are processed in Relay
2. **Set observed timestamp**: When processing log items, set `sentry.observed_timestamp_nanos` to the envelope received time (in nanoseconds)
3. **Use envelope metadata**: Leverage the envelope's received timestamp rather than current processing time

### Expected Code Location (in Relay)
The change would likely be in Relay's envelope processing code where log items are handled, similar to how other enrichment attributes are added.

## Testing Considerations

### Verification Steps
1. **Create test logs**: Send logs through Relay and verify the observed timestamp matches envelope received time
2. **Delay testing**: Introduce artificial processing delays to ensure observed timestamp doesn't change
3. **Frontend validation**: Confirm the "Received" time in the UI reflects the actual envelope received time

### Metrics to Monitor
- Log processing latency
- Accuracy of observed timestamps
- Performance impact of the change

## Impact Assessment

### Benefits
- **Accurate timestamps**: Users will see correct "received" times for logs
- **Better debugging**: Easier to correlate log ingestion timing with system events
- **Consistency**: Aligns with user expectations of when logs were actually received

### Risks
- **Minimal risk**: This is primarily a timestamp correction with no functional impact
- **Compatibility**: Ensure existing log processing isn't affected

## Next Steps

1. **Relay codebase investigation**: Research the Relay codebase to find log envelope processing
2. **Implementation**: Modify Relay to set observed timestamp to envelope received time
3. **Testing**: Validate the change works correctly across different scenarios
4. **Deployment**: Roll out the change with monitoring

## Notes

- This change is specific to logs and should not affect other event types unless explicitly desired
- The current backend Python codebase doesn't need modification for this change
- The frontend already expects and displays the `sentry.observed_timestamp_nanos` field correctly
