from collections.abc import Callable, Mapping
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from sentry.constants import DataCategory
from sentry.preprod.retention import (
    DEFAULT_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
    get_artifact_expiry,
    get_artifact_retention_days,
    get_retention_days,
    get_retention_days_or_default,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


def retention_by_category(
    days: Mapping[DataCategory, int | None],
) -> Callable[..., int | None]:
    """A stand-in for `quotas.backend.get_event_retention`."""
    return lambda organization, category: days[category]


# Size Analysis on the Developer and Team plans, Build Distribution on every plan.
TEAM_PLAN = {DataCategory.SIZE_ANALYSIS: 30, DataCategory.INSTALLABLE_BUILD: 396}


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


class GetArtifactExpiryTest(TestCase):
    @patch("sentry.quotas.backend.get_event_retention")
    def test_artifact_is_retained_for_the_longest_category(self, mock_retention: MagicMock) -> None:
        mock_retention.side_effect = retention_by_category(TEAM_PLAN)

        assert get_artifact_retention_days(self.organization) == 396

    @patch("sentry.quotas.backend.get_event_retention")
    def test_artifact_retention_is_unlimited_if_a_category_is(
        self, mock_retention: MagicMock
    ) -> None:
        mock_retention.side_effect = retention_by_category(
            {DataCategory.SIZE_ANALYSIS: 30, DataCategory.INSTALLABLE_BUILD: None}
        )

        assert get_artifact_retention_days(self.organization) is None

    @freeze_time("2026-01-01T00:00:00Z")
    @patch("sentry.quotas.backend.get_event_retention")
    def test_expiry_counts_from_now(self, mock_retention: MagicMock) -> None:
        mock_retention.side_effect = retention_by_category(TEAM_PLAN)
        now = datetime(2026, 1, 1, tzinfo=UTC)

        assert get_artifact_expiry(self.organization) == {
            "date_expires": now + timedelta(days=396),
            "date_size_analysis_expires": now + timedelta(days=30),
        }

    @patch("sentry.quotas.backend.get_event_retention")
    def test_expiry_counts_from_date_added(self, mock_retention: MagicMock) -> None:
        mock_retention.side_effect = retention_by_category(TEAM_PLAN)
        date_added = datetime(2025, 6, 1, tzinfo=UTC)

        assert get_artifact_expiry(self.organization, date_added) == {
            "date_expires": date_added + timedelta(days=396),
            "date_size_analysis_expires": date_added + timedelta(days=30),
        }

    @patch("sentry.quotas.backend.get_event_retention", return_value=None)
    def test_no_expiry_with_unlimited_retention(self, mock_retention: MagicMock) -> None:
        assert get_artifact_expiry(self.organization) == {
            "date_expires": None,
            "date_size_analysis_expires": None,
        }
