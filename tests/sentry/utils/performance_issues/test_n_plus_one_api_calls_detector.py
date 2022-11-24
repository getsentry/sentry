import pytest

from sentry.testutils import TestCase
from sentry.testutils.performance_issues.event_generators import EVENTS
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.performance_detection import (
    NPlusOneAPICallsDetector,
    get_detection_settings,
    run_detector_on_data,
)


@pytest.mark.django_db
@region_silo_test
class NPlusOneAPICallsDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def test_detect_problems_with_many_concurrent_calls_to_same_url(self):
        event = EVENTS["n-plus-one-api-calls/n-plus-one-api-calls-in-weather-app"]

        detector = NPlusOneAPICallsDetector(self.settings, event)
        run_detector_on_data(detector, event)
        problems = list(detector.stored_problems.values())
        assert problems == []

    def test_does_not_detect_problem_with_concurrent_calls_to_different_urls(self):
        event = EVENTS["n-plus-one-api-calls/not-n-plus-one-api-calls"]

        detector = NPlusOneAPICallsDetector(self.settings, event)
        run_detector_on_data(detector, event)
        problems = list(detector.stored_problems.values())
        assert problems == []
