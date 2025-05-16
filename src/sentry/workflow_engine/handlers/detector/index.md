# Detectors

## DetectorHandler

## StatefulDetector

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
