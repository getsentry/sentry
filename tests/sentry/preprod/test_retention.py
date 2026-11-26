from unittest.mock import MagicMock, patch

from sentry.constants import DataCategory
from sentry.preprod.retention import (
    DEFAULT_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
    get_retention_days,
)
from sentry.testutils.cases import TestCase


class GetRetentionDaysTest(TestCase):
    @patch("sentry.quotas.backend.get_event_retention", return_value=30)
    def test_returns_the_retention_of_the_category(self, mock_retention: MagicMock) -> None:
        assert get_retention_days(self.organization, DataCategory.SIZE_ANALYSIS) == 30
        mock_retention.assert_called_once_with(
            organization=self.organization, category=DataCategory.SIZE_ANALYSIS
        )

    @patch("sentry.preprod.retention.logger")
    @patch("sentry.quotas.backend.get_event_retention", return_value=MAX_RETENTION_DAYS)
    def test_does_not_log_the_maximum(
        self, mock_retention: MagicMock, mock_logger: MagicMock
    ) -> None:
        assert (
            get_retention_days(self.organization, DataCategory.INSTALLABLE_BUILD)
            == MAX_RETENTION_DAYS
        )
        mock_logger.error.assert_not_called()

    @patch("sentry.preprod.retention.logger")
    @patch("sentry.quotas.backend.get_event_retention", return_value=730)
    def test_cuts_a_longer_retention_to_the_maximum(
        self, mock_retention: MagicMock, mock_logger: MagicMock
    ) -> None:
        assert (
            get_retention_days(self.organization, DataCategory.INSTALLABLE_BUILD)
            == MAX_RETENTION_DAYS
        )
        mock_logger.error.assert_called_once_with(
            "preprod.retention.exceeds_max",
            extra={
                "organization_id": self.organization.id,
                "category": DataCategory.INSTALLABLE_BUILD.api_name(),
                "retention_days": 730,
                "max_retention_days": MAX_RETENTION_DAYS,
            },
        )

    @patch("sentry.quotas.backend.get_event_retention", return_value=None)
    def test_default_where_no_retention_is_configured(self, mock_retention: MagicMock) -> None:
        assert (
            get_retention_days(self.organization, DataCategory.SIZE_ANALYSIS)
            == DEFAULT_RETENTION_DAYS
        )
