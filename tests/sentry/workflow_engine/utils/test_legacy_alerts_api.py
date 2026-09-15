from unittest import mock

import pytest

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.utils.legacy_alerts_api import (
    AlertsApiGone,
    enforce_alerts_api_deprecation,
)


@mock.patch("sentry.workflow_engine.utils.legacy_alerts_api.metrics")
class EnforceAlertsApiDeprecationTest(TestCase):
    def test_blocked_call_is_counted_as_impactful(self, mock_metrics: mock.MagicMock) -> None:
        with self.feature({"organizations:legacy-alerts-api": False}):
            with pytest.raises(AlertsApiGone):
                enforce_alerts_api_deprecation(self.organization)

        mock_metrics.incr.assert_called_once_with(
            "workflow_engine.legacy_alerts_api_deprecation",
            tags={"impact": True},
            sample_rate=1.0,
        )

    def test_allowed_call_is_counted_without_impact(self, mock_metrics: mock.MagicMock) -> None:
        with self.feature({"organizations:legacy-alerts-api": True}):
            enforce_alerts_api_deprecation(self.organization)

        mock_metrics.incr.assert_called_once_with(
            "workflow_engine.legacy_alerts_api_deprecation",
            tags={"impact": False},
            sample_rate=1.0,
        )
