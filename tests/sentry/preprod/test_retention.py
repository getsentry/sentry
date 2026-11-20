from unittest.mock import MagicMock, patch

from sentry.constants import DataCategory
from sentry.preprod.retention import (
    DEFAULT_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
    get_retention_days,
    get_retention_days_or_default,
)
from sentry.testutils.cases import TestCase


class GetRetentionDaysTest(TestCase):
    @patch("sentry.quotas.backend.get_event_retention", return_value=30)
    def test_returns_the_retention_of_the_category(self, mock_retention: MagicMock) -> None:
        assert get_retention_days(self.organization, DataCategory.SIZE_ANALYSIS) == 30
        mock_retention.assert_called_once_with(
            organization=self.organization, category=DataCategory.SIZE_ANALYSIS
        )

    @patch("sentry.quotas.backend.get_event_retention", return_value=730)
    def test_cuts_a_longer_retention_to_the_maximum(self, mock_retention: MagicMock) -> None:
        assert (
            get_retention_days(self.organization, DataCategory.INSTALLABLE_BUILD)
            == MAX_RETENTION_DAYS
        )

    @patch("sentry.quotas.backend.get_event_retention", return_value=None)
    def test_unlimited_retention(self, mock_retention: MagicMock) -> None:
        assert get_retention_days(self.organization, DataCategory.SIZE_ANALYSIS) is None
        assert (
            get_retention_days_or_default(self.organization, DataCategory.SIZE_ANALYSIS)
            == DEFAULT_RETENTION_DAYS
        )

    @patch("sentry.quotas.backend.get_event_retention", return_value=30)
    def test_or_default_returns_a_limited_retention(self, mock_retention: MagicMock) -> None:
        assert get_retention_days_or_default(self.organization, DataCategory.SIZE_ANALYSIS) == 30
