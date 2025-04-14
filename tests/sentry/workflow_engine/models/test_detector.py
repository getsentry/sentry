import pytest
from django.db import IntegrityError

from sentry.incidents.grouptype import MetricAlertFire
from sentry.testutils.cases import TestCase


class TestDetector(TestCase):
    def test_single_error_detector_constraint(self):
        self.create_detector(
            type="error",
            config={},
            project=self.project,
        )

        with pytest.raises(IntegrityError):
            self.create_detector(
                type="error",
                config={},
                project=self.project,
            )

    def test_multiple_other_detectors(self):
        self.create_detector(
            type=MetricAlertFire.slug,
            project=self.project,
        )

        self.create_detector(
            type=MetricAlertFire.slug,
            project=self.project,
        )
