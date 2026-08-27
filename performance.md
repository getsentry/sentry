# Sentry Performance Issue Detection: `PerformanceDetector` and the Slow DB Query Detector

A walkthrough of the performance detector system, using `SlowDBQueryDetector` as the worked
example — where the data comes from, how a detector is evaluated, and how a detected problem
becomes an issue in the stream.

Companion to `plan.md` (metric detectors / workflow engine). Read that one first if you haven't;
Part 8 here is a direct comparison of the two systems.

---

## Part 0 — Start here: this is a completely different system

If you just read `plan.md`, the most important thing to internalize is that **performance detectors are not workflow-engine detectors.** The names collide, the concepts rhyme, and the two systems end up in the same place — but almost nothing in between is shared.

|                 | Metric detector (`plan.md`)                     | Performance detector (this doc)                                       |
| --------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| Lives in        | `src/sentry/workflow_engine/`                   | `src/sentry/issue_detection/`                                         |
| Base class      | `StatefulDetectorHandler`                       | `PerformanceDetector`                                                 |
| Input           | A `DataPacket` with one aggregated number       | A list of **spans** from one transaction/segment                      |
| Triggered by    | Snuba pushing subscription results to Kafka     | Event ingestion, synchronously, mid-`save()`                          |
| State           | `DetectorState` in Postgres + counters in Redis | **None.** Everything is in memory, per event                          |
| Config lives in | `Detector.config` (a DB row)                    | System options + `ProjectOption` (migrating to `Detector.config`)     |
| Pattern         | Template Method + state machine                 | **Visitor** over a span list                                          |
| Emits           | `IssueOccurrence` _or_ `StatusChangeMessage`    | `IssueOccurrence` only — no resolution path                           |
| Dedupe          | `dedupe_value` watermark in Redis               | Fingerprint collision within one event, plus `NoiseConfig` downstream |

The last row matters most. A metric detector remembers whether it's currently firing. **A performance detector has no memory whatsoever** — it looks at one transaction's spans, decides whether that transaction contained a problem, and forgets everything. Deduplication and "don't spam me" logic all happen _downstream_, in the Issue Platform.

There's also a genuinely good in-repo doc at `src/sentry/issue_detection/README.md` — read it after this. It covers the checklist for _adding_ a detector; this doc covers understanding an existing one.

### The vocabulary

| Noun                            | File                                                   | What it is                                                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Span**                        | `src/sentry/issue_detection/types.py:16`               | One timed operation inside a transaction: `span_id`, `start_timestamp`, `timestamp`, `op` (e.g. `"db"`), `description` (e.g. the SQL text), `hash`, `parent_span_id`. A `TypedDict`, not a class. |
| **Transaction event / segment** | —                                                      | The container. A dict with a `spans` list. Two flavors, from two ingestion paths — see Part 5.                                                                                                    |
| **`PerformanceDetector`**       | `src/sentry/issue_detection/base.py:53`                | The ABC. A visitor: it gets `visit_span()` called once per span, then `on_complete()`.                                                                                                            |
| **`DetectorType`**              | `base.py:17`                                           | A string enum naming each detector — `SLOW_DB_QUERY = "slow_db_query"`. Doubles as the settings key.                                                                                              |
| **detection settings**          | `performance_detection.py:577`                         | A `dict[DetectorType, dict[str, Any]]` of thresholds, computed per project per event.                                                                                                             |
| **`PerformanceProblem`**        | `src/sentry/issue_detection/performance_problem.py:23` | The output of a detector: fingerprint, op, description, offending span ids, evidence. A plain dataclass.                                                                                          |
| **`GroupType`**                 | `src/sentry/issues/grouptype.py:359`                   | `PerformanceSlowDBQueryGroupType` — the issue type registration, including its noise config.                                                                                                      |
| **`IssueOccurrence`**           | `src/sentry/issues/issue_occurrence.py`                | The Issue Platform payload. Same destination as metric detectors.                                                                                                                                 |

**The chain in one sentence:** a transaction event arrives → `event_manager` flattens its span tree and instantiates every enabled detector → each detector is walked over every span via `visit_span` → detectors deposit `PerformanceProblem`s into `self.stored_problems` → those get mapped to `IssueOccurrence`s and produced to Kafka.

---

## Part 1 — The Python here (vs. what you saw in `plan.md`)

The ABC mechanics are the same as in `plan.md` Part 1 — `abc.ABC`, `@abstractmethod`, runtime-not-compile-time enforcement, everything virtual. Three things are _different_ in this file, and they're worth calling out.

### 1. `ClassVar` annotations that look abstract but aren't

`base.py:58` and `:94`:

```python
class PerformanceDetector(ABC):
    type: ClassVar[DetectorType]
    ...
    settings_key: ClassVar[DetectorType]
```

These are **bare annotations with no value**. In C# you'd reach for an abstract property. Python has no mechanism to require a subclass to _set a class attribute_ — `__abstractmethods__` only tracks methods. So this is a contract enforced by mypy and by convention, not by the runtime.

The failure mode is real: a subclass that forgets `type` will raise `AttributeError` the first time `is_detection_allowed_for_system()` reads `cls.type` (line 110). Nothing catches it earlier.

`ClassVar[X]` tells mypy "this is a class-level attribute, not an instance field" — it's the annotation equivalent of C#'s `static`.

### 2. No generics at all

Compare `plan.md`: `StatefulDetectorHandler[MetricUpdate, MetricResult]` was generic over two type parameters. `PerformanceDetector` is not generic. Every detector consumes the same thing — `Span` — and produces the same thing — `PerformanceProblem`. The variation is entirely in the _logic_, not the types.

### 3. Visitor, not Template Method

`plan.md`'s hierarchy was Template Method: the base owned the algorithm, subclasses filled holes. Here the base owns almost nothing. `PerformanceDetector` provides a few helpers and two gates; the _driver_ is an external free function, `run_detector_on_data` (`performance_detection.py:777`):

```python
def run_detector_on_data(detector: PerformanceDetector, data: dict[str, Any]) -> None:
    if not detector.is_event_eligible(data):
        return

    spans = data.get("spans", [])
    for span in spans:
        detector.visit_span(span)

    detector.on_complete()
```

That's the whole protocol. **Nine lines.** Every performance detector in Sentry is driven by exactly this loop.

The consequence for a detector author: `visit_span` is called with one span at a time and no context. If your detector needs to see relationships _between_ spans (like N+1, which needs to spot repetition), you accumulate state on `self` during `visit_span` and emit in `on_complete`. Slow DB Query needs no such thing — one slow span is one problem — so it emits directly from `visit_span` and doesn't override `on_complete` at all.

---

## Part 2 — `PerformanceDetector`, the base class

`src/sentry/issue_detection/base.py:53-139`. It's 86 lines. Read the whole thing once; it's small enough.

### `__init__` (line 60)

```python
def __init__(self, settings: dict[str, Any], event: dict[str, Any], detector_id: int | None = None) -> None:
    self.settings = settings
    self._event = event
    self.stored_problems: dict[str, PerformanceProblem] = {}
    self.detector_id = detector_id
```

Four fields, and the important one is `stored_problems`. **That dict, keyed by fingerprint, is the detector's entire output.** There's no return value from `visit_span`; the caller reads `detector.stored_problems.values()` when the walk is done (`performance_detection.py:764`).

`settings` is _this detector's_ slice of the settings dict — already narrowed by `settings_key` before construction. `_event` is the whole transaction dict, kept so detectors can read event-level fields (Slow DB Query uses it for `transaction` at `slow_db_query_detector.py:71`).

`detector_id` is the workflow-engine `Detector` row id, if one exists. It's optional and currently **not passed by the main ingestion path** — `performance_detection.py:726` constructs detectors with only two arguments. So in practice it's `None` today; it's forward-plumbing for the WFE migration (Part 4).

### The two gates

This is the piece most likely to confuse you, because there are two of them and they run at different times for different reasons.

**`is_detection_allowed_for_system()`** — `base.py:103`, a `@classmethod`. This is the **global kill switch**, checked _before_ the detector is even instantiated. It looks up the detector's option in `DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION` (`base.py:35`) — for us, `"performance.issues.slow_db_query.problem-creation"` (line 43) — and then:

```python
creation_option_value = options.get(system_option)
if isinstance(creation_option_value, bool):
    return not creation_option_value
elif isinstance(creation_option_value, float):
    return creation_option_value > random.random()
return False
```

Two things to notice:

- The **float branch is a sampling rate**. `0.25` means "run this detector on 25% of events." The registered default for slow DB query is `1.0` (`options/defaults.py:2067`), so it always runs. This is how Sentry ramps a detector's blast radius in production.
- The **bool branch inverts** (`return not value`). A bool `True` means _don't_ run. That reads backwards given the option is named `problem-creation`, and it's worth knowing before you set one — every option currently registered here is a float, so the bool branch is effectively dormant.

Returning `False` for a missing/unknown option (lines 112, 123, 126) is deliberate fail-closed behavior: if you add a detector and forget to register its option, **it silently never runs**. The README calls this out explicitly.

**`is_creation_allowed()`** — `base.py:128`. This is the **per-project switch**, checked _after_ the detector has already run. The base returns `False`, so a detector that doesn't override it does all its work and then throws it away. `SlowDBQueryDetector` overrides it (`slow_db_query_detector.py:103`):

```python
def is_creation_allowed(self) -> bool:
    return self.settings["detection_enabled"]
```

**Why run first and gate after?** Because `report_metrics_for_detectors` (`performance_detection.py:743`) runs in between. Sentry wants to know how many problems _would_ have been created for projects that have the detector disabled — that's how you size a rollout. It's deliberate wasted work in exchange for observability.

**`is_event_eligible()`** — `base.py:137`, a `@classmethod` defaulting to `True`. An early exit for whole events. Other detectors use it (e.g. to skip browser-JS events); `SlowDBQueryDetector` doesn't override it, so every event is eligible.

### The span-filtering helpers

**`find_span_prefix`** (line 71) and **`settings_for_span`** (line 77) exist so detectors don't each reimplement "is this span even the right kind?"

```python
def settings_for_span(self, span):
    op = span.get("op", None)
    span_id = span.get("span_id", None)
    if not op or not span_id:
        return None

    span_duration = get_span_duration(span)
    op_prefix = self.find_span_prefix(self.settings, op)
    if op_prefix:
        return op, span_id, op_prefix, span_duration, self.settings
    return None
```

It returns `None` for "not my kind of span," or a 5-tuple of everything you need. `find_span_prefix` matches `span.op` against the detector's `allowed_span_ops` list by **prefix** — so `["db"]` matches `db`, `db.query`, `db.sql.active_record`, etc.

One honest note on the signature: `find_span_prefix` returns `str | bool` — `True` when there's no filter configured, the matching prefix string when there is one, `False` when nothing matches. Three meanings in one return type. It works because the caller only tests truthiness, but it's the kind of signature that makes you read the body to understand the call site.

**`get_span_duration`** (`detectors/utils.py:322`) is the other primitive:

```python
def get_span_duration(span: Span) -> timedelta:
    return timedelta(seconds=span.get("timestamp", 0)) - timedelta(seconds=span.get("start_timestamp", 0))
```

Span timestamps are float unix seconds; this converts to a `timedelta`. Note the `0` defaults — a span missing timestamps silently gets duration zero rather than raising.

---

## Part 3 — `SlowDBQueryDetector`, line by line

`src/sentry/issue_detection/detectors/slow_db_query_detector.py`. 123 lines, and genuinely the simplest detector in the system — one span in, at most one problem out, no cross-span state.

```python
class SlowDBQueryDetector(PerformanceDetector):
    """
    Check for slow spans in a certain type of span.op (eg. slow db spans)
    """
    type = DetectorType.SLOW_DB_QUERY
    settings_key = DetectorType.SLOW_DB_QUERY
```

`type` and `settings_key` are the same value here (they are for every current detector). `type` identifies the detector for metrics and the system option lookup; `settings_key` indexes into the settings dict at `performance_detection.py:726`.

### `visit_span` (line 34)

**Step 1 — is this even a db span? (lines 35-38)**

```python
settings_for_span = self.settings_for_span(span)
if not settings_for_span:
    return
op, span_id, op_prefix, span_duration, settings = settings_for_span
duration_threshold = settings.get("duration_threshold")
```

The detector's settings are `{"duration_threshold": 1000.0, "allowed_span_ops": ["db"], "detection_enabled": ...}` (`performance_detection.py:584-588`). So this early-returns for every span whose `op` doesn't start with `db`.

**Step 2 — can we fingerprint it? (lines 41-44)**

```python
fingerprint = fingerprint_span(span)
if not fingerprint:
    return
```

`fingerprint_span` (`detectors/utils.py:389`) is `sha1(op + description)[:20]`, and returns `None` if either `op` or `description` is missing. **This is a local, in-event dedupe key — it is not the issue fingerprint.** Two different fingerprints in this file; see Part 6.

**Step 3 — is it a query we care about? (lines 46-47, 106-118)**

```python
def _is_span_eligible(self, span: Span) -> bool:
    description = span.get("description", None)
    if not description:
        return False

    description = description.strip()
    if description[:6].upper() != "SELECT":
        return False

    if description.endswith("..."):
        return False

    return True
```

Two real rules:

- **`SELECT` only.** Slow writes, `CREATE INDEX`, migrations — all ignored. The detector is scoped to reads, where a slow query usually means a missing index or a bad plan rather than expected work.
- **No truncated descriptions.** A description ending in `...` was cut off upstream (SDK or scrubbing). Fingerprinting a truncated query would group unrelated queries together, so it's dropped rather than mis-grouped.

**Step 4 — already reported in this event? (lines 49-54)**

```python
if self.stored_problems.get(fingerprint):
    logging.info("Multiple occurrences detected for fingerprint", extra={"detector": self.settings_key})
    return
```

If the same query text appears twice in one transaction and both are slow, only the first becomes a problem. **This is the only dedupe the detector itself does**, and its scope is a single event.

**Step 5 — the actual check (lines 56-60)**

```python
description = span["description"].strip()

if duration_threshold is not None and span_duration >= timedelta(milliseconds=duration_threshold):
```

That's it. That's the detector. Everything else in this file is filtering and formatting. Default threshold: **1000 ms** (`options/defaults.py:2109`).

**Step 6 — build the problem (lines 61-101)**

```python
evidence_data = {
    "op": op,
    "cause_span_ids": [],
    "parent_span_ids": [],
    "offender_span_ids": spans_involved,
    "transaction_name": self._event.get("transaction", ""),
    "repeating_spans": get_span_evidence_value(span)[:MAX_EVIDENCE_VALUE_LENGTH],
    "repeating_spans_compact": get_span_evidence_value(span, include_op=False)[:MAX_EVIDENCE_VALUE_LENGTH],
    "num_repeating_spans": str(len(spans_involved)),
}
```

The `cause_span_ids` / `parent_span_ids` / `repeating_spans` / `num_repeating_spans` vocabulary is shared across _all_ performance detectors — it's what the issue-details UI renders. For Slow DB Query most of it is degenerate (no cause, no parent, exactly one "repeating" span, count `"1"`), but the shape has to match or the frontend breaks.

`MAX_EVIDENCE_VALUE_LENGTH = 10_000` (line 23) with the comment at lines 19-22: truncation exists because Kafka has a message size limit and `description`, `evidence_data`, and `evidence_display` all carry near-identical copies of the query text.

`get_span_evidence_value` (`detectors/utils.py:285`) formats `"db - SELECT * FROM ..."`, or just the description when `include_op=False`.

Then the `PerformanceProblem` itself (line 81), with `evidence_display` carrying one `IssueEvidence` marked `important=True` — the comment on line 97 explains why: **only `important` evidence appears in notification emails.**

Note `fingerprint=self._fingerprint(hash)` on line 83 — a _different_ fingerprint from the dict key on line 81. That's Part 6.

---

## Part 4 — Where the settings come from

`SlowDBQueryDetector` reads exactly three keys. Tracing where they originate is a tour through Sentry's whole configuration story, and it's mid-migration, so there are two answers.

### The shape

`get_detection_settings` (`performance_detection.py:577`) builds the full `dict[DetectorType, dict]`. Our entry, at line 584:

```python
DetectorType.SLOW_DB_QUERY: {
    "duration_threshold": settings["slow_db_query_duration_threshold"],  # ms
    "allowed_span_ops": ["db"],
    "detection_enabled": settings["slow_db_queries_detection_enabled"],
},
```

`allowed_span_ops` is hardcoded. The other two come from `get_merged_settings` (line 179).

### The legacy path — three layers, merged

`get_merged_settings` builds `legacy_settings` at line 270:

```python
legacy_settings = {
    **system_settings,          # options.get(...) — instance-wide
    **default_project_settings, # projectoptions well-known defaults
    **project_option_settings,  # ProjectOption row — what the user set in project settings UI
}
```

Later dicts win. So for our two keys:

1. **`slow_db_query_duration_threshold`** — `options.get("performance.issues.slow_db_query.duration_threshold")` (line 193), registered with `default=1000.0` at `options/defaults.py:2108`. This is the instance-wide floor, adjustable by Sentry ops without a deploy.
2. **`slow_db_queries_detection_enabled`** — no system option; it comes from `DEFAULT_PROJECT_PERFORMANCE_DETECTION_SETTINGS` (`projectoptions/defaults.py:108`, `True`), overridable per project via the `sentry:performance_issue_settings` ProjectOption (line 264).

### The WFE path — the migration in progress

Sentry is moving performance detector config out of `ProjectOption` and into workflow-engine `Detector` rows — the same `Detector` model from `plan.md`. `SettingsMode` (`performance_detection.py:159`) is the migration dial:

- **`LEGACY`** (0) — ProjectOptions only. Today's default.
- **`COMPARE`** (1) — build both, log every difference (`_log_settings_diff`, line 356), **return legacy**. A dry run to find config drift.
- **`WFE`** (2) — hybrid: WFE `Detector.config` wins for keys it manages, ProjectOptions for the rest (lines 386-400).

`PERFORMANCE_DETECTOR_CONFIG_MAPPINGS` (line 86) is the translation table, and slow DB query is one of only three detectors in it so far:

```python
DetectorType.SLOW_DB_QUERY: PerformanceDetectorConfigMapping(
    settings_key=DetectorType.SLOW_DB_QUERY,
    wfe_detector_type="performance_slow_db_query",   # == the GroupType slug
    detection_enabled_key="slow_db_queries_detection_enabled",
    option_keys={"duration_threshold": "slow_db_query_duration_threshold"},
),
```

Note `wfe_detector_type="performance_slow_db_query"` is exactly `PerformanceSlowDBQueryGroupType.slug` (`grouptype.py:361`). That's the join: `Detector.type` is a GroupType slug, so `_get_wfe_detector_configs` (line 399) can query `Detector.objects.filter(project_id=..., type__in=wfe_types)` and map each row back to a `DetectorType`.

Also note where `detection_enabled` comes from in WFE mode (line 495): **`Detector.enabled`, the model field** — not something inside `config`. The `enabled`/`status` distinction from `plan.md` (`models/detector.py:109-115`) carries over.

The whole mode selection is gated at line 278:

```python
if not project or not features.has("projects:workflow-engine-performance-detectors", project):
    settings_mode = SettingsMode.LEGACY
```

So today, for essentially everyone, this is all dormant and you're on the legacy path.

---

## Part 5 — The data flow, end to end

Where does the data come from? **Two ingestion paths**, and they converge.

### Path A — transaction events, via `event_manager`

This is the original path and still the main one.

**Step A1 — an event arrives.** A transaction event is POSTed to Relay, forwarded to Sentry, and saved via `event_manager.py`'s `save()`, which for transactions calls `save_transaction_events` (`event_manager.py:2713`).

**Step A2 — spans get grouping hashes.** `_calculate_span_grouping` (`event_manager.py:2560`) runs `event.get_span_groupings()` and writes a `hash` onto every span. This is load-bearing for the fingerprint — see Part 6.

**Step A3 — detection runs.** Near the end of the pipeline, `event_manager.py:2758`:

```python
_detect_performance_problems(jobs, projects)
_send_occurrence_to_platform(jobs, projects)
```

`_detect_performance_problems` (`event_manager.py:2584`):

```python
for job in jobs:
    if job["data"].get("_performance_issues_spans"):
        job["performance_problems"] = []
    else:
        job["performance_problems"] = detect_performance_problems(job["data"], projects[job["project_id"]])
```

That `_performance_issues_spans` flag is set by Relay. When present, it means **Path B will handle this event instead**, and this path stands down to avoid emitting the same issue twice.

**Step A4 — the facade.** `detect_performance_problems` (`performance_detection.py:128`) is a try/except wrapper with one job: never let detection break ingestion. It also applies the global sampling gate:

```python
rate = options.get("performance.issues.all.problem-detection")   # default 1.0
if rate and rate > random.random():
    ...
```

Every failure is swallowed and logged (line 150). **Performance detection can never fail an event save.**

**Step A5 — the real work.** `_detect_performance_problems` (`performance_detection.py:696`), in five phases:

_(a) Settings_ (line 709) — `get_detection_settings(project)`, Part 4.

_(b) Flatten the span tree_ (lines 717-720):

```python
tree, segment_id = build_tree(data.get("spans", []))
data = {**data, "spans": flatten_tree(tree, segment_id)}
```

**This is a real prerequisite, not bookkeeping.** Detectors assume spans arrive in the order you'd see them top-to-bottom in the trace waterfall. `build_tree` (line 788) reconstructs parent/child links from `parent_span_id`; `flatten_tree` (line 829) does a DFS from the segment root, visiting children sorted by `start_timestamp` (line 824), then sweeps up orphan spans. The README (`## Detector Assumptions`) states the contract: _"The list of spans are in a flat, sequential hierarchy, the same way they are presented in the trace view."_

Slow DB Query is order-independent — it looks at one span at a time. But N+1 and consecutive-DB detection are entirely built on this ordering.

_(c) Instantiate the survivors_ (lines 722-727):

```python
detectors = [
    detector_class(detection_settings[detector_class.settings_key], data)
    for detector_class in detector_classes
    if detector_class.is_detection_allowed_for_system()
]
```

`detector_classes` defaults to `DETECTOR_CLASSES` (line 674) — the hand-maintained list of all 14 detectors, with `SlowDBQueryDetector` fourth. Gate #1 from Part 2 applies here. Note only two constructor args, so `detector_id` is `None`.

_(d) Run them_ (lines 729-742) — `run_detector_on_data(detector, data)` per detector, each in its own SDK span named `run_detector_on_data.slow_db_query`, each wrapped in try/except so **one broken detector can't take down the others**.

_(e) Collect, gate #2, dedupe_ (lines 756-772):

```python
for detector in detectors:
    if detector.is_creation_allowed():
        problems.extend(detector.stored_problems.values())

unique_problems = set(problems)
```

Metrics are reported at line 744 — _before_ this gate, deliberately (Part 2). The `set()` works because `PerformanceProblem.__hash__` (`performance_problem.py:83`) hashes `(fingerprint, frozenset(offender_span_ids), type)` — cross-detector dedupe, in case two detectors independently flag the same spans.

**Step A6 — emit.** `_send_occurrence_to_platform` (`event_manager.py:2686`) maps each problem to an `IssueOccurrence`:

```python
occurrence = IssueOccurrence(
    id=uuid.uuid4().hex,
    project_id=project.id,
    event_id=event_id,
    fingerprint=[problem.fingerprint],
    type=problem.type,
    issue_title=problem.title,       # == GroupType.description, "Slow DB Query"
    subtitle=problem.desc,           # the SQL text
    culprit=event.transaction,
    evidence_data=problem.evidence_data,
    evidence_display=problem.evidence_display,
    detection_time=event.datetime,
    level=job["level"],
)
produce_occurrence_to_kafka(payload_type=PayloadType.OCCURRENCE, occurrence=occurrence)
```

Same `produce_occurrence_to_kafka` the metric detector called at `workflow_engine/processors/detector.py:266`. **From here the two systems are indistinguishable.**

### Path B — standalone spans, via the segments consumer

Sentry is moving to ingesting spans directly rather than as children of a transaction event. Spans stream in, get buffered and assembled into _segments_, and a consumer processes each completed segment.

**Step B1** — `src/sentry/spans/consumers/process_segments/message.py:174` calls `_detect_performance_problems(segment_span, spans, project)` — a different function with the same name, local to that module.

**Step B2 — option gate** (line 331):

```python
enabled_legacy_detector_types = options.get("spans.process-segments.detect-performance-problems.detectors-enabled")
if not enabled_legacy_detector_types:
    return
```

Registered with `default=[]` (`options/defaults.py:4269`) — **off unless explicitly enabled**, and it's a list of detector-type strings, so rollout is per-detector.

**Step B3 — shim the event** (`message.py:372`):

```python
event_data = build_shim_event_data(segment_span, segment)
```

The segment is reshaped into something that _looks like_ a transaction event, because the existing detectors expect that shape. Then the same `detect_performance_problems` from Path A is called (line 391) with `standalone=True` and an explicit `detector_classes` list resolved from the option via `DETECTOR_TYPE_TO_CLASS_MAP` (line 670).

**Step B4 — emit, but only if Relay said so** (line 404):

```python
if segment_span.get("_performance_issues_spans"):
```

The same flag that made Path A stand down. Exactly one path emits. Without the flag, Path B runs the detectors and throws the results away — useful for measurement before cutover.

The occurrence built here (line 410) differs in small ways: `detection_time` from `segment_span["end_timestamp"]`, hardcoded `level="info"`, and `is_buffered_spans=True` passed to the producer along with a slimmed `event_data` the consumer will persist (lines 405-407).

### Steps 9–10, shared

Downstream of `produce_occurrence_to_kafka`, this is identical to `plan.md` Part 5: the occurrence consumer (`src/sentry/issues/occurrence_consumer.py:356`) reads the topic, matches on fingerprint, creates or updates a `Group`, and `post_process` eventually runs workflows and fires actions.

One performance-specific wrinkle lands here — `NoiseConfig`:

```python
class PerformanceSlowDBQueryGroupType(GroupType):
    type_id = 1001
    slug = "performance_slow_db_query"
    description = "Slow DB Query"
    category = GroupCategory.DB_QUERY.value
    noise_config = NoiseConfig(ignore_limit=100)
    default_priority = PriorityLevel.LOW
    released = True
```

(`grouptype.py:359`.) The comment at `grouptype.py:245` explains it: _"Allows delayed creation of issues for this group type until the issue is seen `noise_config.ignore_limit` times."_ The default is 3 (`grouptype.py:103`); **Slow DB Query requires 100.**

This is the answer to "why doesn't every slow query become an issue immediately?" The detector fires on the very first slow span it sees. The Issue Platform sits on it until it has seen that same fingerprint 100 times. **This is the closest thing this system has to the metric detector's threshold counters — and it lives entirely outside the detector.**

---

## Part 6 — Two fingerprints, and where the span hash comes from

The single subtlest thing in this file. `SlowDBQueryDetector` computes **two different fingerprints** and they do different jobs.

### Fingerprint #1 — the in-event dedupe key

`slow_db_query_detector.py:41`, from `detectors/utils.py:389`:

```python
def fingerprint_span(span: Span) -> str | None:
    op = span.get("op", None)
    description = span.get("description", None)
    if not description or not op:
        return None
    signature = (str(op) + str(description)).encode("utf-8")
    return hashlib.sha1(signature).hexdigest()[:20]
```

Hashes the **raw** op + description. Used only as the `stored_problems` dict key, and only to answer "did I already flag this query in this transaction?" (line 49). It never leaves the process.

### Fingerprint #2 — the issue identity

`slow_db_query_detector.py:120`:

```python
def _fingerprint(self, hash: str) -> str:
    signature = (str(hash)).encode("utf-8")
    full_fingerprint = hashlib.sha1(signature).hexdigest()
    return f"1-{PerformanceSlowDBQueryGroupType.type_id}-{full_fingerprint}"
```

Called with `span.get("hash", "")` (line 63). This is what becomes `IssueOccurrence.fingerprint` and therefore **decides which `Group` this lands in.** The `1-1001-` prefix is a version marker plus the GroupType id, namespacing the fingerprint so a future change to the scheme creates new issues rather than corrupting old ones.

### Why the span `hash` and not the description

Because `hash` is the **normalized** query, and the raw description is not.

`span["hash"]` is written during `_calculate_span_grouping` (`event_manager.py:2560`) by `SpanGroupingStrategy` (`src/sentry/spans/grouping/strategy/base.py:39`). For db spans the relevant strategy is `parametrize_db_span_strategy` (line 212), which:

1. Normalizes `IN (1, 2, 3, ...)` → `IN (%s)`
2. Normalizes `SAVEPOINT x` → `SAVEPOINT %s`
3. Replaces numeric, string, and boolean literals with `%s`

So `SELECT * FROM users WHERE id = 42` and `SELECT * FROM users WHERE id = 99` produce the **same hash**, and therefore the same issue — which is what you want. Fingerprinting on the raw description would create a separate issue per parameter value.

The docstring at lines 213-221 is worth reading — it explains why only single-quoted strings are parameterized (Postgres uses double quotes for identifiers, so touching them would be unsafe).

**The dependency to remember:** if `_calculate_span_grouping` didn't run, every span's `hash` is `""`, every problem gets the fingerprint `sha1("")`, and **every slow query in your org collapses into one issue.** The detector never checks for this.

---

## Part 7 — The span-first rewrite (why there are two of these files)

You will find a second slow query detector at `src/sentry/issue_detection/detectors/span_first/slow_db_query_detector.py`. It is not dead code and not a duplicate — it's the migration target.

`SpanFirstDetector` (`detectors/span_first/base.py:14`) is a parallel ABC for detectors that read **spans directly** rather than a transaction-shaped dict. The differences:

- `__init__` takes `(settings, segment_span, segment, detector_id)` (line 39) — the segment root and the full span list, instead of a fake event dict.
- Fields are `_settings` / `_segment_span`, private-by-convention, versus the legacy class's public `settings` / `_event`.
- `is_creation_allowed` has a **useful default** (line 66): `return self._settings["detection_enabled"]`. In the legacy base it defaults to `False` and every subclass has to override.
- `grouptype` is a required `ClassVar` (line 37) rather than being reached through `PerformanceProblem`.
- Span data is read through accessors — `get_op`, `get_description`, `get_duration` (`span_first_utils.py:45-70`) — because standalone spans store these as _attributes_, not top-level keys.

The logic in `SpanFirstSlowDBQueryDetector.visit_span` (line 36) is the same algorithm, restructured to be readable top-to-bottom with named early exits. Two mechanical differences worth noting:

- `get_duration` returns **float milliseconds** (`span_first_utils.py:68`), so the comparison is `get_duration(span) < duration_threshold` — no `timedelta` construction.
- The in-event dedupe key is the _issue_ fingerprint (line 59), not a separate `fingerprint_span` hash. One fingerprint instead of two.

The fingerprint is deliberately kept byte-identical to the legacy one — see the comment at `span_first_utils.py:53-61`, which explains that `get_grouping_hash` reads Sentry's top-level `hash` rather than Relay's `attributes.sentry.group`, precisely so the two implementations produce matching fingerprints during comparison.

### The parity harness

This is a nice piece of engineering and worth understanding as a pattern. `_maybe_run_span_first_detector_parity_check` (`spans/consumers/process_segments/message.py:437`) runs the new detectors **alongside** the old ones on live traffic, then `compare_span_first_problems_to_control_data` (`detectors/span_first/run_detectors.py:103`) diffs the two result sets field by field (`_collect_single_problem_diffs`, line 213) and logs every mismatch.

Note the sampling detail at lines 128-138: cases where _both_ sides found nothing are counted under a separate metric, so the main comparison metric can run at 100% sample rate without being swamped by trivial agreement. The new detectors produce **no user-visible output** while this runs.

The README's `## Running Experiments` section describes the same strategy at the `GroupType` level, with one warning worth repeating: if you run an experimental detector with a colliding fingerprint, the Issue Platform will see the groups as already existing when you GA, and **notifications, alerts, and assignment will silently never fire.**

---

## Part 8 — Side by side with the metric detector

Now that you've seen both, the comparison is the useful summary.

**Where the data comes from:**

- Metric: Snuba runs a scheduled query and pushes one aggregated number to Kafka. The detector is _subscribed_.
- Performance: an event arrives through normal ingestion carrying its own spans. Nothing is subscribed to anything; detection is a side effect of saving.

**How detectors are selected:**

- Metric: a DB lookup — `Detector.objects.filter(data_sources__source_id=..., data_sources__type=...)` (`caches/detector.py:44`). Which detectors run depends on _which data source the packet came from_.
- Performance: a hardcoded Python list — `DETECTOR_CLASSES` (`performance_detection.py:674`). **Every enabled detector runs on every event.** Selection is by option flags, not data.

**How they're evaluated:**

- Metric: one value compared against `DataCondition` rows in the database, producing a `DetectorPriorityLevel`, fed through a state machine with counters and thresholds.
- Performance: hand-written Python walking spans. **No `DataCondition`, no priority levels, no state.** The threshold is a float in a settings dict and the comparison is `>=` in the detector body.

**How noise is suppressed:**

- Metric: threshold counters in Redis, plus the fire-on-transition-only state machine.
- Performance: `NoiseConfig(ignore_limit=100)` on the GroupType, enforced by the Issue Platform after the fact.

**Resolution:**

- Metric: emits a `StatusChangeMessage` when the value returns below the resolve threshold.
- Performance: **has no resolution concept at all.** A slow query issue is resolved by a human, by ignoring it, or by auto-resolve on staleness. There is no "the query got fast again" signal.

**Failure behavior:**

- Metric: exceptions propagate out of `evaluate` (`base.py:151`) after a metric is tagged.
- Performance: swallowed twice over — per-detector (`performance_detection.py:733`) and around the whole facade (`performance_detection.py:149`). Detection must never break ingestion.

**Where the two converge:** `produce_occurrence_to_kafka`. Both build an `IssueOccurrence`, both key on a fingerprint, both hand off to the Issue Platform, and from there both become `Group`s and both flow into `post_process` → `process_workflows` → actions.

---

## Gotchas worth writing down

1. **Two fingerprints in one file.** `fingerprint_span(span)` (dict key, raw text, in-event only) vs. `self._fingerprint(hash)` (issue identity, normalized query). Confusing them means either duplicate problems or every query collapsing into one issue.
2. **The span `hash` is a hard dependency.** It's written by `_calculate_span_grouping` (`event_manager.py:2560`) before detection runs. No hash → empty fingerprint → one giant issue. Nothing checks for this.
3. **Two gates, deliberately far apart.** `is_detection_allowed_for_system()` before instantiation (global, sampled); `is_creation_allowed()` after the detector has already run (per-project). The gap exists so metrics can measure disabled projects.
4. **`is_creation_allowed` defaults to `False`.** A detector that forgets to override it runs and silently discards everything.
5. **Missing option = detector never runs.** `is_detection_allowed_for_system` returns `False` for an unregistered option (`base.py:112`, `:126`). Fail-closed and silent.
6. **The bool branch of the system option inverts** (`base.py:118`): `return not creation_option_value`. All current options are floats, so it's dormant — but check before setting one.
7. **`_performance_issues_spans` is the anti-double-emit flag.** Set by Relay. Path A stands down when present (`event_manager.py:2587`); Path B only emits when present (`message.py:404`).
8. **Span order is a contract.** `flatten_tree` produces trace-view order and detectors rely on it. Slow DB Query doesn't care; N+1 and consecutive-DB break without it.
9. **The `NoiseConfig` is not in the detector.** `ignore_limit=100` lives on the GroupType (`grouptype.py:364`). If you're wondering why a slow query didn't create an issue, check there before debugging the detector.
10. **`detector_id` is currently always `None`** in the main path — `performance_detection.py:726` passes only two args. The `evidence_data["detector_id"]` branch (`slow_db_query_detector.py:78`) is forward-plumbing for the WFE migration.
11. **`SELECT`-only, no truncated descriptions.** `_is_span_eligible` (line 106). A slow `UPDATE` will never produce this issue type.
