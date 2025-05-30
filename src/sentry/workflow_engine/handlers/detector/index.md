# Detectors

## DetectorHandler

The `DetectorHandler` is an abstract base class used to implement a new Detector. The `DetectorHandler` is responsible for evaluating data packets and creating issue occurrences based on the evaluation results.

Examples:

- N+1 Query Detector: Evaluates the number of queries in a span and creates an issue when thresholds are exceeded.

### Required Methods

#### `create_occurrence`

Creates an issue occurrence when the detector reaches a specified threshold.

This method receives:

- The evaluation result (each data condition with evaluation results)
- The DataPacket
- The resulting priority change

Returns a DetectorOccurrence, which is used along with other platform data to create the IssueOccurrence in the Issue Platform.

```python
class ExampleDetectorHandler(DetectorHandler):
    def create_occurrence(
        self,
        evaluation: DataPacketEvaluationType,
        data_packet: DataPacket,
        new_priority: DetectorPriority,
    ) -> DetectorOccurrence:
        """
        if new_priority == DetectorPriorityLevel.HIGH:
            # can invoke other methods for high priority handling
            pass

        return DetectorOccurrence(
            issue_title=f"self.detector.name triggered",
            substitle=f"Detector {self.detector.name} from {evaluation[0].condition_results[0].condition.type}",
            evidence_data=evaluation,
            evidence_display=[]
            type=MetricIssue,
            level="error",
            culprit="A culprit that was found in the data"
        )
```

#### `extract_value`

Returns the value for evaluation in the detector. This can be:

The generic value passed in as DataPacketEvaluationType
A grouped evaluation returning the format: `dict[DetectorGroupType, DataPacketEvaluationType]`

```python
class ExampleDetectorHandler(StatefulDetectorHandler):
    @property
    def extract_value(self, data_packet: DataPacket) -> DataPacketEvaluationType | dict[DetectorGroupType, DataPacketEvaluationType]:
        return data_packet.packet.get("value")
```

## StatefulDetectorHandler

The StatefulDetectorHandler is used when the detector needs knowledge of previous states to update correctly. For example, when the detector needs to track the number of times it has reached a certain priority level or when it needs to maintain state across multiple evaluations.

The class extends the `DetectorHandler` and provides additional functionality and a default `evaluate` implementation.

Examples:

- Metric Issues: Issues based on metrics over time. When a metric breaches a threshold, the detector creates or resolves an issue accordingly.

#### State Tracking

The StatefulDetectorHandler uses thresholds and other configurations defined in the Detector to determine which state changes to track.

Cascading thresholds: The detector doesn't only track the current state—it also increments counters for any "lower" thresholds.
Example: If a detector is configured with thresholds of 3 for critical and 2 for warn, and receives 2 critical occurrences, the detector will increment both the critical and warn threshold counters. This causes the warn threshold to be breached, creating an issue occurrence for the warn level.

To see [`thresholds`](#thresholds) to see how to customize the thresholds for the detector.

### Required Methods

#### `create_occurrence`

See [`create_occurrence`](#create_occurrence) in the `DetectorHandler` class.

#### `extract_value`

See [`extract_value`](#extract_value) in the `DetectorHandler` class.

### Custom Overrides

#### `thresholds`

StatefulDetectorHandlers track each time the detector reaches a PriorityLevel. When a PriorityLevel's threshold is reached, the detector creates an issue occurrence.

Default behavior: Each PriorityLevel's threshold value is set to 1, so the detector creates an issue occurrence every time it reaches that PriorityLevel.
Override: Use the thresholds property to customize threshold values.

```python
class ExampleDetectorHandler(StatefulDetectorHandler):
    @property
    def thresholds(self) -> DetectorThresholds:
        return {
            DetectorPriorityLevel.LOW: 10,
            DetectorPriorityLevel.HIGH: 5,
        }
```

#### `build_issue_fingerprint`

Adds additional fingerprints to the issue occurrence or status change message. This customizes how issues are grouped together in the issue platform/feed.
Default fingerprint: `{detector.id} or {detector.id}:{detector_group_key}`

The DetectorGroupKey groups evaluation results for a specific detector. For example, when monitoring errors on an API endpoint, you might group issues by endpoint path.

```python
class ExampleDetectorHandler(StatefulDetectorHandler):
    def build_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        uptime = Uptime.objects.get(detector=self.detector)
        return [f"uptime-{uptime.id}"]
```

In the above example, the resulting fingerprints would be: `[uptime-1, detector:1]`, where `uptime-1` is defined in `build_issue_fingerprint` and `detector:1` is the default detector fingerprint.
