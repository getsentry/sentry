# Detectors

## DetectorHandler

The Base `DetectorHandler` abstraction can be used to evaluate DataPackets that can be evaluated by a Detector, and don't require any stateful tracking.

Some examples of these detectors are:

- N+1 Query Detector: It can evaluate the number of queries in a span, and determine that it needs to create an issue.

## StatefulDetectorHandler

The `StatefulDetectorHandler` is used when you need to have knowledge of a previous state to have the detector update correctly.

Examples of stateful detectors are:

- Metric Issues: These issues are based on a metric in time, if the metric breaches a threshold, the detector will create or resolve an issue correspondingly.

### Evaluations (`.evaluate`)

This method will be called for each data packet that is processed by the detector.

The detector will extract the data from each packet, evaluate the conditions, and return a DetectorEvaluationResult or a group of them.

### Thresholds (`.thresholds`)

StatefulDetectorHandlers will track each time the detector reaches a PriorityLevel.

If a PriorityLevel's threshold is reached, the detector will create an issue occurrence. By default, each PriorityLevel's threshold value is set to 1, so the detector will create an issue occurrence each time it reaches that PriorityLevel.

To override these thresholds use the `counters` property in the constructor.

For example:

```python
class ExampleDetectorHandler(StatefulDetectorHandler):
    thresholds: DetectorThresholds = {
        DetectorPriorityLevel.LOW: 10,
        DetectorPriorityLevel.HIGH: 5,
    }
```
