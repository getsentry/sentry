from typing import Any
from unittest import mock

from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
from sentry.incidents.grouptype import MetricIssue
from sentry.incidents.metric_detector_quota import (
    can_enable_metric_detectors,
    get_metric_detector_quota,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.workflow_engine.models import Detector


@with_feature("organizations:workflow-engine-metric-detector-limit")
@mock.patch("sentry.quotas.backend.get_metric_detector_limit", return_value=2)
class MetricDetectorQuotaTest(TestCase):
    def _metric_detector(self, **kwargs: Any) -> Detector:
        return self.create_detector(project=self.project, type=MetricIssue.slug, **kwargs)

    def test_counts_only_enabled_active_metric_detectors(
        self, _mock_get_limit: mock.MagicMock
    ) -> None:
        self._metric_detector(enabled=True)
        self._metric_detector(enabled=False)
        self._metric_detector(enabled=True, status=ObjectStatus.PENDING_DELETION)
        self.create_detector(project=self.project, type=ErrorGroupType.slug, enabled=True)

        quota = get_metric_detector_quota(self.organization)

        assert quota.count == 1
        assert quota.limit == 2
        assert not quota.has_exceeded

    def test_disabled_detectors_leave_room(self, _mock_get_limit: mock.MagicMock) -> None:
        self._metric_detector(enabled=True)
        self._metric_detector(enabled=False)
        self._metric_detector(enabled=False)

        assert not get_metric_detector_quota(self.organization).has_exceeded

    def test_exceeded_at_limit(self, _mock_get_limit: mock.MagicMock) -> None:
        self._metric_detector(enabled=True)
        self._metric_detector(enabled=True)

        assert get_metric_detector_quota(self.organization).has_exceeded

    def test_can_enable_up_to_limit(self, _mock_get_limit: mock.MagicMock) -> None:
        self._metric_detector(enabled=True)

        quota = get_metric_detector_quota(self.organization)
        assert can_enable_metric_detectors(quota, 1)
        assert not can_enable_metric_detectors(quota, 2)

    def test_unlimited_plan(self, limit: mock.MagicMock) -> None:
        limit.return_value = -1
        self._metric_detector(enabled=True)

        quota = get_metric_detector_quota(self.organization)
        assert not quota.has_exceeded
        assert can_enable_metric_detectors(quota, 100)


@mock.patch("sentry.quotas.backend.get_metric_detector_limit", return_value=0)
class MetricDetectorQuotaFlagOffTest(TestCase):
    def test_flag_off_is_unlimited(self, _mock_get_limit: mock.MagicMock) -> None:
        quota = get_metric_detector_quota(self.organization)
        assert not quota.has_exceeded
        assert can_enable_metric_detectors(quota, 5)
