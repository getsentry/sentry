# Sentry Workflow Engine: Detectors, Data Packets, and Metric Issues

A walkthrough of the detector handler class hierarchy and the end-to-end data flow
from a Snuba query subscription to an issue in the stream.

---

## Part 0 — The vocabulary first

Before any code, you need seven nouns. Everything in this system is one of these, and the whole "chain of information" is just these seven in order.

| Noun                  | Model / file                                              | What it is                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SnubaQuery**        | `src/sentry/snuba/models.py`                              | The _definition_ of a query: dataset, aggregate (`count()`), a search filter, a `time_window` (e.g. 5 min), and a `resolution` (how often to re-run). Pure config — it doesn't run anything.                                                                                                                                                                  |
| **QuerySubscription** | `src/sentry/snuba/models.py:142`                          | A _live subscription_ in Snuba to that query, scoped to one project. Snuba re-runs the query on a schedule and pushes results at us. This is the thing that actually produces data.                                                                                                                                                                           |
| **DataSource**        | `src/sentry/workflow_engine/models/data_source.py:28`     | The workflow engine's generic _pointer_ to "some upstream thing that emits data." It has a `type` (a string, e.g. `"snuba_query_subscription"`) and a `source_id` (a string, e.g. `"4711"` — the QuerySubscription's primary key). It is deliberately untyped so the engine can point at Snuba subscriptions, cron monitors, or uptime checks with one model. |
| **DataPacket**        | `src/sentry/workflow_engine/models/data_source.py:22`     | One _delivery_ of data from a source. Just `source_id: str` + `packet: T`. Note it's a plain `@dataclass`, not a Django model — it never hits the DB.                                                                                                                                                                                                         |
| **Detector**          | `src/sentry/workflow_engine/models/detector.py:94`        | The rule. It has a many-to-many to `DataSource` (line 104) — "these are the sources I subscribe to" — a `type` slug that names a `GroupType`, a `config` JSON blob, and a FK to a `DataConditionGroup` (line 121) that holds its thresholds.                                                                                                                  |
| **DataCondition**     | `src/sentry/workflow_engine/models/data_condition.py:123` | One threshold: `type` (`GREATER`), `comparison` (the number `100`), `condition_result` (what to return if it matches — for detectors, a `DetectorPriorityLevel` like `HIGH`). Grouped under a `DataConditionGroup` with a `logic_type` (defaults to `ANY`).                                                                                                   |
| **IssueOccurrence**   | `src/sentry/issues/issue_occurrence.py`                   | The output. A generic "an issue happened" payload that Sentry's Issue Platform turns into a `Group` in the issue stream.                                                                                                                                                                                                                                      |

**The chain in one sentence:** a `QuerySubscription` produces results → something wraps them in a `DataPacket` and calls `process_data_packet` → the engine looks up which `Detector`s subscribe to that `DataSource` → each detector's _handler_ evaluates the packet's value against its `DataCondition`s → if a threshold is breached it emits an `IssueOccurrence` to Kafka.

---

## Part 1 — Python ABCs, from C#

`src/sentry/workflow_engine/handlers/detector/base.py:89`:

```python
class DetectorHandler(abc.ABC, Generic[DataPacketType]):
    def __init__(self, detector: Detector):
        self.detector = detector

    @abc.abstractmethod
    def evaluate(self, data_packet: DataPacket[DataPacketType]) -> dict[DetectorGroupKey, DetectorEvaluation]:
        pass
```

In C# that's roughly:

```csharp
public abstract class DetectorHandler<TDataPacket>
{
    protected readonly Detector detector;
    protected DetectorHandler(Detector detector) { this.detector = detector; }
    public abstract Dictionary<string?, DetectorEvaluation> Evaluate(DataPacket<TDataPacket> p);
}
```

Here are the differences that will actually bite you.

### 1. `abc.ABC` is opt-in, and it's a metaclass trick

C# has `abstract` as a first-class keyword. Python doesn't. `abc.ABC` is just a base class whose metaclass (`ABCMeta`) runs code at class-creation time to collect every method marked `@abc.abstractmethod` into a set called `__abstractmethods__`. `object.__new__` then refuses to instantiate a class with a non-empty set.

Consequence: **abstractness is not checked by the compiler, it's checked at `MyClass()` call time.** If you subclass `BaseDetectorHandler` and forget `extract_value`, nothing complains until runtime, at the moment something calls `detector.detector_handler` (`detector.py:194`, `return self.settings.handler(self)`). Mypy will catch it in CI, but the language itself will not.

Second consequence: if you _forget_ to inherit `abc.ABC`, `@abc.abstractmethod` becomes a no-op decoration and the class becomes instantiable with unimplemented methods that return `None`. That's why you see `abc.ABC` re-listed on `StatefulDetectorHandler` at `stateful.py:314-317` even though its parent is already abstract — it's cheap insurance and a signal to readers.

### 2. There is no `virtual` / `override` — everything is virtual

Every Python method is virtual. There's no `sealed`, no `new` shadowing, no compile error if you accidentally redefine a base method with a different signature. `MetricIssueDetectorHandler.build_detector_evidence_data` (`grouptype.py:189`) overrides the base's no-op version at `stateful.py:351` purely by name match.

Corollary: an "abstract method with a body" and a "virtual method with a default" look almost identical. The only difference is the decorator. Compare:

- `stateful.py:344` `build_issue_fingerprint` — a **hook**, has a default (`return []`), overriding is optional.
- `base.py:187-196` `extract_value` — `@abc.abstractmethod`, body is `pass`, overriding is **mandatory**.

When you're reading a base class in Python, the decorator is the _only_ thing telling you which contract you're looking at. Scan for `@abc.abstractmethod` first.

### 3. Generics are erased, and `TypeVar` must be declared separately

`base.py:25-26`:

```python
DataPacketType = TypeVar("DataPacketType")
DataPacketEvaluationType = TypeVar("DataPacketEvaluationType")
```

C# writes `class Foo<T>` and `T` springs into existence. Python requires you to create the type variable as a module-level object first, then mention it in `Generic[...]`. That's why these two names are exported from the package (`handlers/detector/__init__.py`) — subclasses in other files need the same objects.

**More importantly: Python generics are erased at runtime.** `StatefulDetectorHandler[MetricUpdate, MetricResult]` carries zero runtime information. There is no `typeof(T)`, no reflection over type arguments. It's documentation for mypy and for you.

This is why `MetricIssueDetectorHandler.extract_value` has to do this at `grouptype.py:269`:

```python
if isinstance(data_packet.packet, AnomalyDetectionUpdate):
```

It cannot ask "what was `T` instantiated as?" — it must inspect the actual object. Get used to `isinstance` where you'd reach for a generic type check in C#.

### 4. Multiple inheritance replaces interfaces

`base.py:104`:

```python
class BaseDetectorHandler(
    DetectorHandler[DataPacketType],
    Generic[DataPacketType, DataPacketEvaluationType],
):
```

Python has no `interface` keyword; ABCs fill both the "abstract base class" and "interface" roles, and you can inherit several. Here it's inheriting the abstract base _and_ re-declaring itself generic over a second parameter — because the parent was generic over one type and the child needs two.

`super().__init__(detector)` (`base.py:121`) is `base(detector)`. Python resolves `super()` through the MRO (method resolution order, C3 linearization), so with multiple inheritance `super()` doesn't necessarily mean "my declared parent." In this file the hierarchy is a straight line, so it does.

### 5. `@property` ≈ a get-only property

`stateful.py:337-342`:

```python
@property
def thresholds(self) -> DetectorThresholds:
    return {}
```

Called as `self.thresholds`, not `self.thresholds()`. A subclass overrides it by redefining the whole property. This is a common Python idiom for "a constant a subclass may want to compute" — the C# equivalent of `protected virtual Dictionary<...> Thresholds => new();`.

### 6. The pattern you're looking at is Template Method

The class hierarchy here is a textbook Template Method: the base class owns the _algorithm_, and abstract methods are the _holes_ subclasses fill. `BaseDetectorHandler.evaluate` (line 142) is the sealed entry point; `evaluate_impl` is the hole. `StatefulDetectorHandler` fills `evaluate_impl` with the real algorithm and opens four _new_ holes: `extract_value`, `extract_dedupe_value`, `create_occurrence`, and the optional `build_detector_evidence_data`. `MetricIssueDetectorHandler` fills those.

Keep that shape in your head: **three layers, each one narrowing the contract.**

---

## Part 2 — `DetectorHandler` and `BaseDetectorHandler`

### `DetectorHandler` — the bare interface

`base.py:89-101`. Two things only: it holds a `Detector`, and it promises an `evaluate(data_packet) -> dict[DetectorGroupKey, DetectorEvaluation]`.

That return type deserves a stop. A single data packet can carry values for _several_ things at once — imagine one query grouped by `transaction`, returning a value per transaction. `DetectorGroupKey` is `str | None` (`types.py:72`), and `None` means "this detector is ungrouped, there's exactly one value." So the return is always a dict, and for metric issues today it's always a one-entry dict keyed by `None`. Don't let the dict fool you into thinking metric alerts are grouped — the plumbing supports it, this detector doesn't use it.

`process_detectors` at `processors/detector.py:281` calls only this interface — it never knows about `BaseDetectorHandler` or `StatefulDetectorHandler`.

### `BaseDetectorHandler` — infrastructure + the contract

`base.py:104-206`.

**`__init__` (line 120)** eagerly loads the detector's `DataConditionGroup` into `self.condition_group`, checking the prefetch cache first (`Detector.workflow_condition_group.is_cached(detector)`) before falling back to `get_from_cache`. This matters because the detector was likely fetched with `select_related("workflow_condition_group")` upstream (`caches/detector.py:49`) — this avoids re-querying. On failure it logs and sets `None` rather than raising; a detector with no conditions is degraded, not fatal.

**`evaluate` (line 142)** is a thin wrapper that exists purely for metrics. It calls `evaluate_impl`, tags the result `success` / `tainted` / `failure`, emits `workflow_engine_detector.evaluation`, and re-raises on exception. Note the `TODO` on line 156: they want to rename `evaluate_impl` → `evaluate` and this one → `_evaluate`. Read `evaluate` as "the public sealed method"; the real work is always in `evaluate_impl`.

("Tainted" means a condition evaluation hit an error but the group still produced a result — see `DataConditionGroupEvaluation.error`.)

**The four abstract methods** (lines 159–206) are the contract every concrete detector fills:

| Method                 | Question it answers                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `evaluate_impl`        | The whole algorithm. `StatefulDetectorHandler` implements this once for everyone.                                          |
| `extract_value`        | "Given this packet, what number/object do I compare against my thresholds?"                                                |
| `extract_dedupe_value` | "Given this packet, what monotonically increasing `int` identifies its position in the stream?" (usually a unix timestamp) |
| `create_occurrence`    | "I decided to fire — build the user-facing issue."                                                                         |

Also defined in this file, and worth knowing by name:

- **`DetectorOccurrence`** (line 42) — a frozen dataclass, the _detector-flavored_ description of an issue: title, subtitle, level, culprit, assignee, evidence. Its `to_issue_occurrence` (line 55) converts it into the platform-wide `IssueOccurrence` by adding the fields only the framework knows: occurrence id, project id, fingerprint, merged evidence data. This split is deliberate — a handler author writes the human-meaningful half and never touches fingerprints.
- **`GroupedDetectorEvaluationResult`** (line 84) — `{result: dict[...], tainted: bool}`. Only exists so `evaluate_impl` can report taintedness to `evaluate` for the metric tag, then get unwrapped.

---

## Part 3 — `StatefulDetectorHandler`

`src/sentry/workflow_engine/handlers/detector/stateful.py:314`. This is where the actual behavior lives. "Stateful" means: **this detector remembers whether it is currently firing**, so it can emit an occurrence on the _transition_ into a bad state and a resolution on the transition back — rather than screaming on every single data packet.

### The state it keeps, and where

Three pieces, split across two stores:

**In Postgres** — `DetectorState` (one row per detector × group key): `is_triggered: bool` and `state: DetectorPriorityLevel`. This is the durable "am I currently firing, and at what severity."

**In Redis** — two things, both keyed by `detector:{id}:{group_key}:{suffix}` (`build_key`, line 171):

1. `:dedupe_value` — the highest `extract_dedupe_value` we've fully processed. Guards against Kafka replays and out-of-order delivery.
2. `:{priority_level}` — a counter per priority level. This implements "fire only after N consecutive breaching periods."

Redis is used for the hot, high-churn values; Postgres for the one you'd want to survive a Redis flush.

**`DetectorStateManager`** (line 71) owns all of this. Its API is deliberately two-phase: you `enqueue_*` changes during evaluation (lines 89–107, which just write into in-memory dicts), then call `commit_state_updates()` once at the end (line 185), which flushes Redis via a pipeline and Postgres via `bulk_create`/`bulk_update`. One round trip each, no matter how many group keys.

**`DetectorStateData`** (line 51) is the read-side snapshot: the frozen `(group_key, is_triggered, status, dedupe_value, counter_updates)` tuple for one group key, assembled by `get_state_data` (line 255) from one Postgres query plus one Redis pipeline.

### `__init__` and thresholds

`stateful.py:322`:

```python
default_thresholds = {level: 1 for level in self._get_configured_detector_levels()}
self._thresholds = {
    DetectorPriorityLevel.OK: 1,
    **default_thresholds,
    **(self.thresholds),      # handler class override
    **(thresholds or {}),     # per-instance override
}
```

`_get_configured_detector_levels` (line 614) reads `self.detector.get_conditions()` and pulls out each condition's `condition_result` — so the set of priority levels this detector can produce is _derived from its own DataConditions_, not hardcoded. If a detector has a `GREATER 100 → HIGH` condition and a `GREATER 50 → MEDIUM` condition, the levels are `{HIGH, MEDIUM}` and both default to threshold 1.

The three-layer merge (`{**a, **b, **c}` is dict-merge, later wins) is the standard Python override chain: framework default → class override → instance override.

### `evaluate_impl` — the state machine

`stateful.py:413-487`. This is the single most important function in the whole flow. Read it line by line:

```python
dedupe_value = self.extract_dedupe_value(data_packet)              # 417
group_data_values = self._extract_value_from_packet(data_packet)   # 418
state = self.state_manager.get_state_data(list(group_data_values.keys()))  # 419
```

One dedupe value for the whole packet; a `{group_key: value}` dict of things to evaluate; and the current state for exactly those group keys.

`_extract_value_from_packet` (line 524) is the normalizer: your `extract_value` may return a bare value _or_ a dict; if bare, it wraps it as `{None: value}` so the loop below is uniform. **Note the sharp edge** — `_is_detector_group_value` (line 601) decides which by checking "is this a non-empty dict whose keys are all `str | None`". A handler whose evaluation value is _itself_ a dict of strings would be misread as a grouped result. This is precisely the bug `MetricIssueDetectorHandler.extract_value` works around at `grouptype.py:269-273`; more on that below.

Then, per group key:

**a) Dedupe (line 425).** `if dedupe_value <= state_data.dedupe_value: continue`. Already seen; drop it.

**b) Claim it (line 430).** `enqueue_dedupe_update` — recorded now, committed at the end, so even a no-op evaluation advances the watermark.

**c) Evaluate conditions (line 432).** `_evaluation_detector_conditions` (line 649) calls `process_data_condition_group(self.condition_group, value)` and then, at line 683:

```python
new_priority = max(new_priority, *validated_condition_results)
```

The group's `logic_type` is `ANY` (the model default, `data_condition_group.py:46`), so _all_ conditions are evaluated and the group triggers if any matched. Then the handler takes the **maximum** priority among the matched ones. If both `>50 → MEDIUM` and `>100 → HIGH` match, you get `HIGH`. This is why `DetectorPriorityLevel` is an `IntEnum` (`types.py:62`) — `max()` needs the ordering.

**Where resolution comes from:** the same condition group also holds an inverted condition with `condition_result = OK` — see `migration_helpers/alert_rule.py:400-404`, which creates e.g. `LESS_OR_EQUAL resolve_threshold → OK`. So when the metric drops back down, the group still _triggers_ (the OK condition matched), `evaluated_priority` is `OK`, and the machine below treats that as a transition to resolved. This is the piece that confuses most people reading `evaluate_impl` for the first time: **resolution is not "the group failed to trigger," it's "a condition whose result is OK triggered."** If the group triggers nothing at all (line 439), we `continue` and nothing happens.

**d) Already at this priority? (line 444).** `if state_data.status == evaluated_priority: continue` — with a counter reset first (line 452), so a metric that flirts with `MEDIUM` and falls back to `HIGH` doesn't leave a stale partial count.

**e) Increment counters (line 456).** `_increment_detector_thresholds` (line 694). Two branches:

- Going to `OK`: unset every level's counter, set the `OK` counter to +1.
- Going to a firing level: increment every level `<= new_priority` (excluding `OK`). So a `HIGH` breach bumps both `MEDIUM` and `HIGH` — because a `HIGH` value is by definition also a `MEDIUM` value.

**f) Have we breached? (line 460).** `_has_breached_threshold` (line 715) sorts levels descending and returns the first whose count meets its threshold, or `None`. `None` → we've seen a breach but not enough consecutive ones yet → `continue`.

**g) Same as current? (line 466).** Guard against re-firing.

**h) Commit the transition (line 474).** `enqueue_state_update(group_key, new_priority != OK, new_priority)`.

**i) Build the result (line 480).** `_build_detector_evaluation_result` (line 548) branches on the new priority:

- **`OK`** → `_create_resolve_message` (line 490) builds a `StatusChangeMessage` with `new_status=GroupStatus.RESOLVED` and the fingerprint of the existing issue.
- **anything else** → calls your `create_occurrence`, then `_create_decorated_issue_occurrence` (line 618) which attaches the fingerprint and merges in the framework's evidence data, then stamps the `event_data` dict with `timestamp` / `project_id` / `event_id` / `platform` / `received` (lines 583–589).

Both paths produce a `DetectorEvaluation` (`processors/evaluations/detector.py:17`) — `result` is either an `IssueOccurrence` or a `StatusChangeMessage`, plus `triggered: bool` and `priority`.

Finally, line 486: `self.state_manager.commit_state_updates()` — the single flush.

### The fingerprint

This is how "fire" and "resolve" find the same issue. Both paths build it identically:

```python
fingerprint = [*self.build_issue_fingerprint(group_key), self.state_manager.build_key(group_key)]
```

(`stateful.py:632` and `:496`). `build_key(None)` returns `"detector:{detector_id}"`. So every occurrence from a given metric detector shares a fingerprint, which means the Issue Platform maps them all onto one `Group`, and the `StatusChangeMessage` with the same fingerprint resolves that `Group`. `build_issue_fingerprint` (line 344) is the hook for adding more; `MetricIssueDetectorHandler` doesn't override it.

### Evidence data

Two functions, merged:

- `_build_workflow_engine_evidence_data` (line 387) — framework-level: `detector_id`, the evaluated `value`, `data_packet_source_id`, the _snapshots of the conditions that triggered_, the detector `config`, and serialized `data_sources`. That `detector_id` key is load-bearing far downstream — `processors/detector.py:186` reads it back out of the occurrence to figure out which detector produced an event.
- `build_detector_evidence_data` (line 351) — the subclass hook, empty by default.

---

## Part 4 — `MetricIssueDetectorHandler`

`src/sentry/incidents/grouptype.py:188`:

```python
class MetricIssueDetectorHandler(StatefulDetectorHandler[MetricUpdate, MetricResult]):
```

Reading the two type arguments (line 57, 59):

- `MetricUpdate = ProcessedSubscriptionUpdate | AnomalyDetectionUpdate` — what's inside `data_packet.packet`.
- `MetricResult = float | AnomalyDetectionValues` — what `extract_value` pulls out and what the conditions compare against.

Two shapes because there are two detection modes: static/percent thresholds compare a plain `float`; **dynamic** (anomaly detection) hands the whole `AnomalyDetectionValues` dict to Seer.

It implements exactly the four hooks and adds one helper. Note what it _doesn't_ implement: no `evaluate`, no `evaluate_impl`, no `thresholds`, no `build_issue_fingerprint`. All of that is inherited. **Since it doesn't override `thresholds`, every level defaults to 1 — metric alerts fire on the first breaching period.**

### `extract_dedupe_value` (line 263)

```python
return int(data_packet.packet.timestamp.timestamp())
```

The subscription update's timestamp as unix seconds. Monotonic in the stream, so it doubles as the replay guard.

### `extract_value` (line 266)

```python
if isinstance(data_packet.packet, AnomalyDetectionUpdate):
    grouped: dict[DetectorGroupKey, MetricResult] = {None: data_packet.packet.values}
    return grouped
return data_packet.packet.values["value"]
```

Static path: return the bare float. Anomaly path: return the whole `values` dict — but **explicitly wrapped in `{None: ...}`**. Read the comment on line 270. This is the `_is_detector_group_value` sharp edge from Part 3: `AnomalyDetectionValues` is a dict with string keys (`value`, `source_id`, `subscription_id`, `timestamp`), so a bare return would be misidentified as a grouped result with four group keys. Wrapping it forcibly says "one ungrouped value that happens to be a dict."

Why does anomaly detection need the whole dict? Because `AnomalyDetectionHandler.evaluate_value` (`src/sentry/incidents/handlers/condition/anomaly_detection_handler.py:59`) reads `source_id` back out of it (line 66-69) to re-fetch the `QuerySubscription` and pass historical context to Seer. The condition handler needs more than a number.

### `create_occurrence` (line 208)

Four lookups, each raising `DetectorException` on failure:

1. The `DataCondition` whose `condition_result` equals the priority we're firing at (line 215) — this is the specific threshold that tripped, needed to write the subtitle.
2. The `QuerySubscription`, **by `data_packet.source_id`** (line 224). Remember `source_id` is `str(QuerySubscription.id)`.
3. The `SnubaQuery` behind it (line 231) — needed for the aggregate name and time window.
4. The assignee, resolved from `detector.owner` (line 238), non-fatal.

Then it returns the pair `(DetectorOccurrence, event_data)`:

```python
DetectorOccurrence(
    issue_title=self.detector.name,
    subtitle=self.construct_title(snuba_query, detector_trigger, priority),
    evidence_data={**self.build_detector_evidence_data(...)},
    type=MetricIssue,
    level="error",
    priority=priority,
    ...
)
```

`type=MetricIssue` is the `GroupType` class right below at line 350 — that's what routes this into the metric-issue category in the issue stream.

### `build_detector_evidence_data` (line 189)

Adds one key: `alert_id`, from `AlertRuleDetector` (line 196) — the join table mapping the legacy `AlertRule` to the new `Detector`. This is compatibility plumbing so the frontend, which still knows about alert rules, can link an issue back to one.

### `construct_title` (line 276)

Pure string formatting; no state, no I/O beyond `self.detector`. Produces either `"Detected an anomaly in the query for {alert_type}"` (dynamic) or `"Critical: Number of events in the last 5 minutes above 100"`. Worth reading once so you can recognize the strings when you see them in the UI.

### `MetricIssue` — the registration point (line 350)

```python
@dataclass(frozen=True)
class MetricIssue(GroupType):
    type_id = 8001
    slug = "metric_issue"
    detector_settings = DetectorSettings(
        handler=MetricIssueDetectorHandler,
        validator=MetricIssueDetectorValidator,
        config_schema={...},
    )
```

**This is the wiring you'd otherwise go looking for.** There is no DI container. `Detector.type` is a string (`"metric_issue"`); `Detector.group_type` (`detector.py:172`) looks that slug up in the global `grouptype.registry`; `Detector.detector_handler` (`detector.py:180`) reads `.detector_settings.handler` off the resulting class and instantiates it with `self.settings.handler(self)` (line 194). **A fresh handler instance per evaluation** — which is why all the real state lives in Redis/Postgres and not on `self`.

`config_schema` is a JSON Schema validated against `Detector.config` on save (`detector.py:264`). That's the same dict `SubscriptionProcessor` reads as `MetricIssueDetectorConfig` (`subscription_processor.py:48`): `comparison_delta` and `detection_type`.

---

## Part 5 — The data flow, end to end

Ten steps, upstream to downstream.

### Step 1 — Setup: someone creates a metric alert

Not per-packet, but you need it to understand the rest. Creating an alert produces, roughly:

- a `SnubaQuery` (`snuba/subscriptions.py:25`) — the query definition
- a `QuerySubscription` (`snuba/subscriptions.py:180`) with `type="incidents"` (`INCIDENTS_SNUBA_SUBSCRIPTION_TYPE`, `incidents/utils/constants.py:1`), which fires `create_subscription_in_snuba.delay(...)` on commit (line 203) — the async task that actually registers the subscription with Snuba and fills in `subscription_id` (the Snuba-side UUID)
- a `Detector` with `type="metric_issue"`, plus a `DataConditionGroup` holding the trigger conditions and the resolve condition
- a `DataSource` with `type="snuba_query_subscription"` and `source_id=str(query_subscription.id)` (see `explore/translation/alerts_translation.py:109` or `migration_helpers/alert_rule.py:471`)
- a `DataSourceDetector` row (`models/data_source_detector.py`) joining that DataSource to that Detector — **this is the "detectors subscribe to data sources" edge**

### Step 2 — Snuba runs the query and emits to Kafka

Snuba owns the schedule. Every `resolution` seconds it re-runs the subscription's query over the last `time_window` and writes the result to a Kafka topic (one topic per dataset — see `snuba/query_subscriptions/constants.py`).

**This is the answer to "where does `subscription_processor.py` get its data from": it doesn't pull. Snuba pushes.**

### Step 3 — The consumer parses the Kafka message

`src/sentry/snuba/query_subscriptions/consumer.py`.

- `parse_message_value` (line 36) validates against the `sentry_kafka_schemas` codec and reshapes it into a `QuerySubscriptionUpdate` TypedDict (`incidents/utils/types.py:10`): `entity`, `subscription_id`, `values`, `timestamp`.
- `handle_message` (line 65) looks up the `QuerySubscription` by that `subscription_id` — note, **the Snuba UUID, not the Postgres PK** (line 105). Skips if the subscription is inactive; if it doesn't exist at all, it tells Snuba to delete the orphan (line 125).

### Step 4 — Dispatch through the subscriber registry

`consumer.py:151`: `if subscription.type not in subscriber_registry: ... return`, then `consumer.py:160` `callback = subscriber_registry[subscription.type]`, then `consumer.py:180` `callback(contents, subscription)`.

`subscriber_registry` is a plain module-level dict (line 21) populated by the `@register_subscriber` decorator (line 24). The registration for metric alerts is `src/sentry/incidents/tasks.py:27`:

```python
@register_subscriber(INCIDENTS_SNUBA_SUBSCRIPTION_TYPE)   # "incidents"
def handle_snuba_query_update(subscription_update, subscription) -> None:
    SubscriptionProcessor.process(subscription, subscription_update)
```

This decorator-registry idiom is everywhere in this codebase — `data_source_type_registry`, `condition_handler_registry`, `grouptype.registry`, `action_handler_registry`. It's Python's substitute for DI container registration, and the catch is that **registration only happens if the module gets imported.** That's why you'll see otherwise-pointless imports like `from sentry.incidents.handlers.condition import *  # noqa` at `grouptype.py:11` — it exists solely to run the `@condition_handler_registry.register` decorators.

### Step 5 — `SubscriptionProcessor` turns a subscription update into a DataPacket

`src/sentry/incidents/subscription_processor.py`. Despite the file's location under `incidents/`, this class is now purely an adapter into the workflow engine.

`process` (line 76) — the classmethod entry point:

- looks up the `Detector` by `data_sources__source_id=str(subscription.id)` + `data_sources__type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION` (line 88). Note `str(subscription.id)` — the **Postgres PK**, not the Snuba UUID from step 3. Two different identifiers, easy to confuse.
- warms the `Project` and `Organization` caches (lines 107, 118) so downstream code doesn't re-query
- constructs the processor and calls `process_update`

`__init__` (line 63) loads `self.last_update` from Redis via `get_detector_last_update` (line 276). **This is a second, independent dedupe layer** from the stateful handler's `dedupe_value` — same idea, different key (`detector:{id}:project:{id}:last_update`, line 272), different Redis cluster (`SENTRY_INCIDENT_RULES_REDIS_CLUSTER` vs `SENTRY_WORKFLOW_ENGINE_REDIS_CLUSTER`). Worth knowing about so you don't chase one when the other is the culprit.

`process_update` (line 210):

1. Feature/plan gate: `is_metric_subscription_allowed` (line 218)
2. Dedupe: `if subscription_update["timestamp"] <= self.last_update: return False` (line 225)
3. **Reduce the raw rows to a single number** — `get_aggregation_value` (line 148). This is the real content of this file. For the `Metrics` dataset it's the crash-rate math (`1 - crashed/count`, line 152); otherwise `get_comparison_aggregation_value` (line 156), which pulls the value out and, if the detector's `comparison_delta` is set, divides it by the value from `comparison_delta` seconds ago to produce a percentage change. That's the "percent" detection type.
4. Bail if `None` or `NaN` (line 253) — but still store `last_update`, so a bad row doesn't get reprocessed forever
5. `process_results_workflow_engine` (line 171)
6. Store `last_update` (line 266)

`process_results_workflow_engine` (line 171) is the boundary. It branches on `detection_type`:

```python
if detector_cfg["detection_type"] == AlertRuleDetectionType.DYNAMIC.value:
    anomaly_detection_packet = AnomalyDetectionUpdate(
        values={"value": aggregation_value, "source_id": str(self.subscription.id), ...},
    )
    data_packet = DataPacket[AnomalyDetectionUpdate](source_id=str(self.subscription.id), packet=...)
else:
    metric_packet = ProcessedSubscriptionUpdate(values={"value": aggregation_value}, ...)
    data_packet = DataPacket[ProcessedSubscriptionUpdate](source_id=str(self.subscription.id), packet=...)

results = process_data_packet(data_packet, DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION)
```

These are the two arms of `MetricUpdate` from Part 4, and `source_id=str(self.subscription.id)` is the key that will be matched against `DataSource.source_id`. **This call at line 193/206 is the handoff from the incidents subsystem into the generic workflow engine.**

### Step 6 — `process_data_packet` fans out

`src/sentry/workflow_engine/processors/data_packet.py:8`. Two lines:

```python
data_packet, detectors = process_data_source(data_packet, query_type)
return process_detectors(data_packet, detectors)
```

`process_data_source` (`processors/data_source.py:23`) → `bulk_fetch_enabled_detectors` (line 11) → `get_detectors_by_data_source` (`caches/detector.py:22`), which is a cache in front of:

```python
Detector.objects.filter(data_sources__source_id=source_id, data_sources__type=query_type)
    .select_related("workflow_condition_group")
    .prefetch_related("workflow_condition_group__conditions")
```

(`caches/detector.py:44-53`). **This is literally "which detectors subscribe to this data source."** The `select_related`/`prefetch_related` are why `BaseDetectorHandler.__init__` and `get_conditions()` don't re-query. Disabled detectors are filtered out at `data_source.py:19`.

Note this is a _list_ — one data source can feed many detectors. The metric-alert path today is 1:1, but the engine doesn't assume that.

### Step 7 — `process_detectors` runs each handler

`src/sentry/workflow_engine/processors/detector.py:275`:

```python
for detector in detectors:
    handler = detector.detector_handler          # 281 — registry lookup, fresh instance
    if not handler: continue
    detector_results = handler.evaluate(data_packet)   # 294

    for result in detector_results.values():
        if result.result is not None:
            ... metrics + logging ...
            create_issue_platform_payload(result, detector.type)   # 322
```

`handler.evaluate` is `BaseDetectorHandler.evaluate` → `StatefulDetectorHandler.evaluate_impl` → everything in Parts 2 and 3. `result.result is not None` is the "did anything change" check — most packets produce an empty dict and nothing happens here.

### Step 8 — Emit to the Issue Platform

`create_issue_platform_payload` (`processors/detector.py:245`) branches on the type of `result.result` — `IssueOccurrence` → `PayloadType.OCCURRENCE`, else `StatusChangeMessage` → `PayloadType.STATUS_CHANGE` — and calls `produce_occurrence_to_kafka` (line 266).

**This is where the detector's job ends.** It has written to Kafka and returned.

### Step 9 — The Issue Platform creates/updates the Group

A separate consumer (`src/sentry/issues/occurrence_consumer.py:356`) reads that topic, matches on fingerprint, and creates or updates a `Group` — this is the row you see in the issue stream. Status changes resolve the existing group.

### Step 10 — Workflows fire the actions

`src/sentry/tasks/post_process.py:1039` queues `process_workflows_event`, which runs `process_workflows` (`workflow_engine/processors/workflow.py:525`). That looks up `Workflow`s attached to the detector, evaluates _their_ condition groups (the "action filters" created at `migration_helpers/alert_rule.py:323`), and fires `Action`s — Slack, PagerDuty, email.

The link back to the detector is `evidence_data["detector_id"]`, read at `processors/detector.py:186` — the field `_build_workflow_engine_evidence_data` wrote back in step 7.

---

## Part 6 — The "chain of information", made precise

> data sources that call process data packet, detectors that subscribe to certain data packets, and then the detectors emit issues

All three are right; here's each one pinned to code, plus the one nuance:

**"Data sources call `process_data_packet`."** Almost — the data _source_ is a passive DB row (`DataSource`, a `type` + `source_id`). What calls `process_data_packet` is the _ingestion code for that source type_: for Snuba subscriptions that's `SubscriptionProcessor.process_results_workflow_engine` (`subscription_processor.py:193`). Other source types have their own callers — grep for `process_data_packet(` and you'll find uptime and cron doing the same thing with their own packet shapes. The `DataSource` row is the _join key_ that lets the generic engine find the right detectors; the `source_id` on the `DataPacket` is what matches it.

**"Detectors subscribe to certain data packets."** Precisely: `Detector.data_sources` M2M through `DataSourceDetector`, and the lookup is `caches/detector.py:44`. Subscription is by `(source_id, type)` pair, not by packet content.

**"Detectors emit issues."** Via `handler.evaluate` → `create_issue_platform_payload` → `produce_occurrence_to_kafka` (`processors/detector.py:266`). They emit to Kafka; a different consumer materializes the `Group`.

**The one thing to add:** it's not a single emit, it's a _state machine_. `StatefulDetectorHandler` emits on **transitions** — into a firing priority, or back to `OK`. Steady state emits nothing. That's the whole reason `DetectorState` and the Redis counters exist.

---

## Gotchas worth writing down

1. **Two different subscription identifiers.** `QuerySubscription.subscription_id` is the Snuba-side UUID (used in step 3, from the Kafka payload). `QuerySubscription.id` is the Postgres PK and is what becomes `DataSource.source_id` and `DataPacket.source_id` (steps 5–6). Mixing them up produces a silent "detector not found."
2. **Two independent dedupe layers.** `subscription_processor.py:276` (per detector+project, `SENTRY_INCIDENT_RULES_REDIS_CLUSTER`) and `stateful.py:171` (per detector+group key, `SENTRY_WORKFLOW_ENGINE_REDIS_CLUSTER`).
3. **Resolution is a condition, not the absence of one.** The detector's condition group contains a `condition_result=OK` condition (`migration_helpers/alert_rule.py:402`). No triggered condition at all means nothing happens.
4. **Handler instances are per-evaluation** (`detector.py:194`). Never cache anything on `self` expecting it to survive.
5. **Registries need imports to fire.** `grouptype.py:11`'s `import *  # noqa` is load-bearing.
6. **Generics are erased.** `extract_value` uses `isinstance`, and `_is_detector_group_value` (`stateful.py:601`) sniffs dict shape — which is why `grouptype.py:272` wraps the anomaly dict in `{None: ...}`.
7. **`DetectorPriorityLevel` is an `IntEnum`** so `max()` and `<=` work on it (`stateful.py:683`, `:702`).
