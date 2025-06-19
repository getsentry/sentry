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
- We store the list of `PerformanceProblem`s from `_detect_performance_problems` on `job["performance_problems"]`
- Then we run `_send_occurrence_to_platform` which reads `job["performance_problems"]`
  - It will map each `PerformanceProblem` into an `IssueOccurrence`
  - Then run `produce_occurrence_to_kafka` from [producer.py](../../issues/producer.py) which passes the occurence along to the [Issue Platform](https://develop.sentry.dev/backend/issue-platform/)

For context, the Issue Platform operates off of the the GroupType subclasses (from [group_type.py](../../issues/grouptype.py)). The [issue platform docs](https://develop.sentry.dev/backend/issue-platform/#releasing-your-issue-type) provide a way to control the rollout of new `GroupType`s via the `released` property. Keep in mind, **this rollout is entirely separate from the PerformanceDetector**! The checks within `_detect_performance_problem` may skip running the detector, or skip creating problems completely all before they ever reach the Issue Platform.

### Detector Assumptions

The current performance detectors make some assumptions about the spans that are passed along to `visit_span()` when they are traversing the transaction event and scanning for problems. It's possible some detectors may assemble their own data structure internally, but generally performance detectors assume:

- The list of spans are in a flat, sequential hierarchy, the same way they are presented in the trace view.
- The spans are fixed to one transaction. They do not persist data between separate events or handle streaming, everything is in memory.

## Adding a Detector

There are quite a few places which need to be updated when adding a new performance detector:

- [ ] Create a file in [/detectors](./detectors)
- [ ] Add a `PerformanceDetector` subclass (see [base.py](./base.py)) to the new file
- [ ] Add the subclass to `DETECTOR_CLASSES` in [performance_detection.py](./performance_detection.py)
- [ ] Add a key to `DetectorType` in [base.py](./base.py)
- [ ] Register a `performance.issues.<detector_name>.problem-creation` option in [defaults.py](../../options/defaults.py)
- [ ] Add an entry to `DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION` in [base.py](./base.py) with that new option
- [ ] Create a new `GroupType` in [grouptype.py](../../issues/grouptype.py)
- [ ] Update `get_detection_settings()` (in [performance_detection.py](./performance_detection.py))
  - [ ] Add a key for your `DetectorType`, with a value of an empty dictionary
  - [ ] If your value is not customizable, add it to the dictionary
  - [ ] If it is customizable, access it via `settings[key_name]`
    - [ ] Then add it to [project_performance_issue_settings.py](../../api/endpoints/project_performance_issue_settings.py), either `InternalProjectOptions` or `ConfigurableThresholds`
    - [ ] In the same file, Add it to the mappings `project_settings_to_group_map`/`thresholds_to_manage_map` using the new GroupType
    - [ ] In the same file, Add a serializer field to `ProjectPerformanceIssueSettingsSerializer` to allow it to be validated from the inbound API.
    - [ ] (Optional) The frontend file (`projectPerformance.tsx`) should add the new field.
    - [ ] Then, to set a default value, register an option in [defaults.py](../../options/defaults.py)
    - [ ] And finally, respect that default value by modifying `get_merged_settings()` in [performance_detection.py](./performance_detection.py)
- [ ] Setup for the `PerformanceDetector` subclass
  - [ ] Update the `type` and `settings_key` attributes with the new `DetectorType`
  - [ ] (Optional) Implement `is_event_eligible()` to allow early exits.
  - [ ] Implement `is_creation_allowed_for_organization()` to check a feature flag.
  - [ ] Implement `is_creation_allowed_for_project()` to check a creation flag.
- [ ] Write some business logic!
  - [ ] Implement `visit_span()` and `on_complete()`, adding any identified `PerformanceProblem`s to `self.stored_problems` as you go.
  - [ ] Leverage the [Writing Detectors docs](https://develop.sentry.dev/backend/issue-platform/writing-detectors/) which can help guide your detector's design.

## Running Experiments

Since performance detectors have such high throughput (by operating on all ingested spans), changes to things like logical flow, or fingerprinting can have huge unintended consequences. We do the best we can to write tests, but it's not realistic to test every possible edge case that we'll see in production. Instead we have to be strategic about making these sorts of edits.

Currently, we have a loose system called `experiments`, which can be found in the [/detectors/experiments](./detectors/experiments/) and [tests/.../performance_issues/experiments](../../../../tests/sentry/performance_issues/experiments/) directories. Experiments are useful for when we want to make a risky change to a live detector, but want to double check the output before releasing it. You can run a new experiment by following these steps:

### Setup the Experiment

- [ ] Create a new `GroupType` in [grouptype.py](../../issues/grouptype.py). By convention, the `type_id` uses 19xx (e.g. 1002 -> 1902), and the `slug` and `description` include 'experimental'. **Ensure `released` is set to False**
- [ ] Add a key to `DetectorType` in [base.py](./base.py).
- [ ] Update `get_detection_settings()` (in [performance_detection.py](./performance_detection.py)) with the new experimental `DetectorType` key. The value can stay as a copy of the existing detector.
- [ ] Copy/paste the existing detector into [/detectors/experiments](./detectors/experiments/)
  - [ ] Rename the detector class to include `Experimental`
  - [ ] Swap usage of the existing `DetectorType` and `GroupType` to the experimental ones
  - [ ] If you want to immediately start running the detector on all production data, override `is_detection_allowed_for_system`, otherwise you'll have to meter the detector rollout with an entry to `DETECTOR_TYPE_ISSUE_CREATION_TO_SYSTEM_OPTION` in [base.py](./base.py)
  - [ ] **Ensure fingerprints do not collide with the existing detector**
    - A lot of detectors use `GroupType` for fingerprinting, but if not, make a temporary change manually. If you don't do this, then once you start ingesting production data, the groups will be identical to what they would be if you GA'd, but without running `post_process`. This will mean once GA'd, the issue platform sees that the groups _already exist_ and so won't fire notifications, trigger alerts, assign correctly, or any of the other steps from `post_process`.
- [ ] Add the experimental `PerformanceDetector` to `DETECTOR_CLASSES` in [performance_detection.py](./performance_detection.py)
- [ ] Next, copy/paste the detector test into [tests/.../performance_issues/experiments](../../tests/sentry/performance_issues/experiments/)
  - [ ] Again, swap the `DetectorType` and `GroupType` to the experimental ones
  - [ ] Correct any failing tests in the new experiment file
  - [ ] Correct any failing tests in the existing file. You may be able to just use the [`@exclude_experimental_detectors()`](../../testutils/performance_issues/experiments.py) decorator for a quick edit.

### Making Changes

Once all the above is merged, we can begin functional changes. You can try out new detection schemes, strategies or fingerprinting, without any impact on user experience. You'll also be able to add tests, and iterate on the changes as much as you want without affecting the existing detector.

One note though, you may want to keep an eye on the metrics for `run_detector_on_data.<detector-name>` to ensure it doesn't unreasonably increase the runtime compared to the existing detector.

To start ingesting user data, you can use the issue platform [release flags](https://develop.sentry.dev/backend/issue-platform/#releasing-your-issue-type):

```sh
sentry createissueflag --slug=<experiment-grouptype-slug> --owner=<your-team>
```

These flags don't need to be defined in `sentry`, you just have to add them to Flagpole.

You'll only want to GA the 'ingest' flag, but the 'post-process' and 'ui' flags can help you get an end to end experience prior to adding your changes to the existing detector.

Once the change has been deemed sufficiently tested, reverse the setup:

- [ ] Copy/paste the experiment into [/detectors/](./detectors/), replacing the original
  - [ ] Remove `Experimental` from the detector class name
  - [ ] Swap usage of the experimental `DetectorType` and `GroupType` to the existing ones
  - [ ] Remove the override for `is_detection_allowed_for_system` if applicable.
  - [ ] **Revert any manual changes to the fingerprinting**
- [ ] Next, copy/paste the experiment test into [tests/.../performance_issues/](../../../tests/sentry/performance_issues/), replacing the original
  - [ ] Again, swap the experimental `DetectorType` and `GroupType` to the existing ones
  - [ ] Correct any failing tests in the file

Once all that is good to go, ensure you clean up the experiment files and any options/flags you may have set
while iterating.
