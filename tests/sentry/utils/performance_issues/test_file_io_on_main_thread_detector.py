import unittest

import pytest

from sentry.testutils.performance_issues.event_generators import EVENTS
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.performance_detection import (
    FileIOMainThreadDetector,
    get_detection_settings,
    run_detector_on_data,
)


@region_silo_test
@pytest.mark.django_db
class NPlusOneAPICallsDetectorTest(unittest.TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def test_gives_problem_correct_title(self):
        event = EVENTS["file-io-on-main-thread"]

        detector = FileIOMainThreadDetector(self.settings, event)
        run_detector_on_data(detector, event)
        problem = list(detector.stored_problems.values())[0]
        assert problem.title == "File IO on Main Thread"
