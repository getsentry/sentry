# Performance Issues (Updated: 2025-05-07)

[Performance issues](https://docs.sentry.io/product/issues/issue-details/performance-issues/) are composed of a few different parts which control how they manifest in the app to users. This document will outline those parts, and then explain how to go about creating a new performance detector, and experimenting with changes to performance detectors.

## Lifecycle of a Performance Issue

Performance Issues are built on top of the [Issue Platform](https://develop.sentry.dev/backend/issue-platform/) which already has great documentation as to its usage. The internal logic for each detector varies, but here's a general walkthrough of how a performance issue is generated end-to-end.

- First an event comes in, it is persisted via [event_manager.py](../../event_manager.py)'s `save()` method.
  - When the `event_type` is a `transaction`, it also calls `save_transaction_events()`
  - There are many nested function calls, but eventually we get to [performance_detection.py](./performance_detection.py)'s `_detect_performance_problems` and `_send_occurrence_to_platform` functions.
- The `_detect_performance_problem` function takes in the transaction event, and spits out a list of `PerformanceProblem`s which are generated from running the detector on all of the spans in the event.
  - This function starts with all the detectors listed in `DETECTOR_CLASSES`
  - Next, the list is filtered by running `PerformanceDetector.is_detection_allowed_for_system()` from [base.py](./base.py)
    - By default, this check will cross-reference `DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION` from [base.py](./base.py)
    - If `PerformanceDetector.type` isn't in that dictionary, **it will not run the detector**.
    - If the system option is unregistered, or has no default, **it will not run the detector**.
    - If the system option is a boolean, it will only run the detector if set to `True`.
    - If the system option is a number (0.0 < `x` < 1.0), it will run the detector `100 * x`% of the time.
  - After this check, the detectors are run on the event, see `run_detector_on_data()` in [performance_detection.py](./performance_detection.py)
  - After recording metrics about the results, two checks are run, dropping the `PerformanceProblem`s if either return `False`:
    - `PerformanceDetector.is_creation_allowed_for_organization()` - Pre-GA, check a feature flag; post-GA, just return `True`
    - `PerformanceDetector.is_creation_allowed_for_project()` - Usually checking project's detector settings
  - Lastly, we trunacte any `PerformanceProblem`s in excess of `PERFORMANCE_GROUP_COUNT_LIMIT` from [performance_detection.py](./performance_detection.py)
- We store the list of `PerformanceProblem`s from `_detect_performance_problems` on `job["performance_problems"]`
- Then we run `_send_occurrence_to_platform` which reads `job["performance_problems"]`
  - It will map each `PerformanceProblem` into an `IssueOccurrence`
  - Then run `produce_occurrence_to_kafka` from [producer.py](../../issues/producer.py) which passes the occurence along to the [Issue Platform](https://develop.sentry.dev/backend/issue-platform/)

For context, the Issue Platform operates off of the the GroupType subclasses (from [group_type.py](../../issues/grouptype.py)). The [issue platform docs](https://develop.sentry.dev/backend/issue-platform/#releasing-your-issue-type) provide a way to control the rollout of new `GroupType`s via the `released` property. Keep in mind, **this rollout is entirely separate from the PerformanceDetector**! The checks within `_detect_performance_problem` may skip running the detector, or skip creating problems completely all before they ever reach the Issue Platform.

## Adding a Detector

There are quite a few places which need to be updated when adding a new performance detector:

- [ ] Create a file in [/detectors](./detectors)
- [ ] Add a `PerformanceDetector` subclass (see [base.py](./base.py)) to the new file
- [ ] Add the subclass to `DETECTOR_CLASSES` in [performance_detection.py](./performance_detection.py)
- [ ] Add a key to `DetectorType` in [base.py](./base.py)
- [ ] Register a `performance.issues.<detector_name>.problem-creation` option in [defaults.py](../../options/defaults.py)
- [ ] Add an entry to `DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION` in [base.py](./base.py) with that new option
- [ ] Update `get_detection_settings()` (in [performance_detection.py](./performance_detection.py))
  - [ ] Add a key for your `DetectorType`, with a value of an empty dictionary
  - [ ] If your value is not customizable, add it to the dictionary
  - [ ] If it is customizable, access it via `settings[key_name]` - [ ] Then add it to [project_performance_issue_settings.py](../../api/endpoints/project_performance_issue_settings.py), either `InternalProjectOptions` or `ConfigurableThresholds` - [ ] In the same file, Add it to the map, either `internal_only_project_settings_to_group_map` or `configurable_thresholds_to_internal_settings_map` - [ ] In the same file, Add a serializer field to `ProjectPerformanceIssueSettingsSerializer` to allow it to be validated from the inbound API.
        static/app/views/settings/projectPerformance/projectPerformance.tsx
        /Users/leander/dev/sentry/static/app/views/settings/projectPerformance/projectPerformance.tsx - [ ] (Optional) The frontend file (`projectPerformance.tsx`) should add the new field. - [ ] Then, to set a default value, register an option in [defaults.py](../../options/defaults.py) - [ ] And finally, respect that default value by modifying `get_merged_settings()` in [performance_detection.py](./performance_detection.py)
- [ ] Setup for the `PerformanceDetector` subclass
  - [ ] Update the `type` and `settings_key` attributes with the new `DetectorType`
  - [ ] (Optional) Implement `is_event_eligible()` to allow early exits.
  - [ ] Implement `is_creation_allowed_for_organization()` to check a feature flag.
  - [ ] Implement `is_creation_allowed_for_project()` to check a creation flag.
- [ ] Write some business logic! Implement `visit_span()` and `on_complete()`, adding any identified `PerformanceProblem`s to `self.stored_problems` as you go.

## Adding an Experiment

TODO(Leander): Fill this in.

### Detector Assumptions

The current performance detectors make some assumptions about the spans that are passed along to `visit_span()` when they are traversing the transaction event and scanning for problems. It's possible some detectors may assemble their own data structure internally, but generally performance detectors assume:

- The list of spans are in a flat, sequential hierarchy, the same way they are presented in the trace view.
- The spans are fixed to one transaction. They do not persist data between separate events or handle streaming, everything is in memory.
