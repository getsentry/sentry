# Detectors

## DetectorHandler

The Base `DetectorHandler` abstraction can be used to evaluate DataPackets that can be evaluated by a Detector, and don't require any stateful tracking.

Some examples of these detectors are:

- N+1 Query Detector: It can evaluate the number of queries in a span, and determine that it needs to create an issue.

## StatefulDetectorHandler

The `StatefulDetectorHandler` is used when you need to have knowledge of a previous state to have the detector update correctly.

Examples of stateful detectors are:

- Metric Issues: These issues are based on a metric in time, if the metric breaches a threshold, the detector will create or resolve an issue correspondingly.

### Required Methods

#### `create_occurrence`

The `create_occurrence` method is used to create an issue occurrence when the detector reaches a certain threshold. This method is passed the evaluation result (each data condition with each result of the evaluation), the data packet, and the resulting priority change.

The result of this method is a `DetectorOccurrence`, this data and other platform data is used to create the IssueOccurrence in the Issue Platform.

```python
class ExampleDetectorHandler(StatefulDetectorHandler):
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

This is used to return the value for evaluation in the detector. The value can be the generic value passed in as the `DataPacketEvaluationType` or it can be a grouped evaluation returning a format like: `dict[DetectorGroupType, DataPacketEvaluationType]`.

```python
class ExampleDetectorHandler(StatefulDetectorHandler):
    @property
    def extract_value(self, data_packet: DataPacket) -> DataPacketEvaluationType | dict[DetectorGroupType, DataPacketEvaluationType]:
        return data_packet.packet.get("value")
```

### Custom Overrides

#### Thresholds (`.thresholds`)

StatefulDetectorHandlers will track each time the detector reaches a PriorityLevel.

If a PriorityLevel's threshold is reached, the detector will create an issue occurrence. By default, each PriorityLevel's threshold value is set to 1, so the detector will create an issue occurrence each time it reaches that PriorityLevel.

To override these thresholds use the `counters` property in the constructor.

For example:

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

This method is used to add additional fingerprints to the issue occurrence or status change message. This allows you to create customize how issues are grouped together in the issue platform / feed.
The default issue occurrence fingerprint is `{detector.id}` or `{detector.id}:{detector_group_key}` The `detector_group_key` is used to group evaluation results for a specific detector. An example of this is could be monitoring errors on an API endpoint, and we want to group the issues by the endpoint path.

```python
class ExampleDetectorHandler(StatefulDetectorHandler):
    def build_issue_fingerprint(self, group_key: DetectorGroupKey = None) -> list[str]:
        uptime = Uptime.objects.get(detector=self.detector)
        return [f"uptime-{uptime.id}"]
```

If the above example was used, the resulting fingerprints would be: [`uptime-1`, `1:None`]. Where `uptime-1` is what we defined in `build_issue_fingerprint` and `1:None` is the default fingerprint for the detector.

### State Tracking

How does the detector track state? The `StatefulDetectorHandler` uses the `thresholds` and other thresholds defined in the `Detector` to decide which state changes of the detector track.

The detector doesn't only track the state that just happened though, it also increments for any "lower" thresholds. For example, if a detector is configured to have a threshold of 3 `critical` and 2 `warn` in the threshold and we receive 2 critical occurrences, the detector will increment the `critical` and `warn` thresholds. This will cause the `warn` threshold to be breached, and create an issue occurrence for it.
