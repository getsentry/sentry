from sentry.issue_detection.detectors.span_first.span_first_utils import (
    SpanFirstDetectorsRolloutController,
)

# Dummy assertion just to use the class somehow. If we don't, no module which runs at app startup
# imports it (consumer factories apparently don't get loaded right away), which means its options
# never get registered because `SafeRolloutComparator.__init_subclass__` is never run.
# Once the new span-first detectors are fully rolled out, we can get rid of this.
assert SpanFirstDetectorsRolloutController  # type: ignore[truthy-function]
