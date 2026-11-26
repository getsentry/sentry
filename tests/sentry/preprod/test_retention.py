from collections.abc import Callable, Mapping
from datetime import UTC, datetime, timedelta
from unittest.mock import MagicMock, patch

from sentry.constants import DataCategory
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.retention import (
    DEFAULT_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
    get_artifact_expiry,
    get_artifact_retention_days,
    get_retention_days,
    get_snapshot_expiry,
    is_expired,
    is_size_analysis_expired,
    unexpired_artifacts,
    unexpired_size_analysis,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time


def retention_by_category(
    days: Mapping[DataCategory, int | None],
) -> Callable[..., int | None]:
    """A stand-in for `quotas.backend.get_event_retention`."""
    return lambda organization, category: days[category]


# Size Analysis and Build Distribution on the Team plan.
TEAM_PLAN = {DataCategory.SIZE_ANALYSIS: 30, DataCategory.INSTALLABLE_BUILD: 396}


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


class GetArtifactExpiryTest(TestCase):
    @patch("sentry.quotas.backend.get_event_retention")
    def test_artifact_is_retained_for_the_longest_category(self, mock_retention: MagicMock) -> None:
        mock_retention.side_effect = retention_by_category(TEAM_PLAN)

        assert get_artifact_retention_days(self.organization) == 396

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


class GetSnapshotExpiryTest(TestCase):
    @freeze_time("2026-01-01T00:00:00Z")
    @patch("sentry.quotas.backend.get_event_retention")
    def test_expiry_counts_from_now(self, mock_retention: MagicMock) -> None:
        mock_retention.side_effect = retention_by_category(TEAM_PLAN)
        now = datetime(2026, 1, 1, tzinfo=UTC)

        # The Size Analysis retention, not the longer one of Build Distribution.
        assert get_snapshot_expiry(self.organization) == {"date_expires": now + timedelta(days=30)}
        mock_retention.assert_called_once_with(
            organization=self.organization, category=DataCategory.SIZE_ANALYSIS
        )

    @patch("sentry.quotas.backend.get_event_retention")
    def test_expiry_counts_from_date_added(self, mock_retention: MagicMock) -> None:
        mock_retention.side_effect = retention_by_category(TEAM_PLAN)
        date_added = datetime(2025, 6, 1, tzinfo=UTC)

        assert get_snapshot_expiry(self.organization, date_added) == {
            "date_expires": date_added + timedelta(days=30)
        }


class ExpiredArtifactsTest(TestCase):
    """
    `is_expired` and `is_size_analysis_expired`, and the `unexpired_artifacts` and
    `unexpired_size_analysis` filters, which must agree with them.
    """

    def assert_expired(
        self, artifact: PreprodArtifact, expired: bool, size_analysis_expired: bool
    ) -> None:
        artifacts = PreprodArtifact.objects.filter(id=artifact.id)

        assert is_expired(artifact) is expired
        assert artifacts.filter(unexpired_artifacts()).exists() is not expired
        assert is_size_analysis_expired(artifact, self.organization) is size_analysis_expired
        assert (
            artifacts.filter(unexpired_size_analysis(self.organization)).exists()
            is not size_analysis_expired
        )

    @patch("sentry.quotas.backend.get_event_retention", return_value=30)
    def test_stamped_expiry_outlives_a_shorter_current_retention(
        self, mock_retention: MagicMock
    ) -> None:
        # Ingested under a 396 day retention, and the plan was downgraded since.
        artifact = self.create_preprod_artifact(
            project=self.project,
            date_added=before_now(days=60),
            date_expires=before_now(days=60 - 396),
            date_size_analysis_expires=before_now(days=60 - 396),
        )

        assert not is_size_analysis_expired(artifact, self.organization)
        mock_retention.assert_not_called()
        self.assert_expired(artifact, expired=False, size_analysis_expired=False)

    @patch("sentry.quotas.backend.get_event_retention", return_value=396)
    def test_stamped_expiry_is_not_extended_by_a_longer_current_retention(
        self, mock_retention: MagicMock
    ) -> None:
        # Ingested under a 30 day Size Analysis retention, and the plan was upgraded since.
        # The build itself is retained for longer, for Build Distribution.
        artifact = self.create_preprod_artifact(
            project=self.project,
            date_added=before_now(days=60),
            date_expires=before_now(days=60 - 396),
            date_size_analysis_expires=before_now(days=60 - 30),
        )

        self.assert_expired(artifact, expired=False, size_analysis_expired=True)

    @patch("sentry.quotas.backend.get_event_retention", return_value=396)
    def test_artifact_past_date_expires(self, mock_retention: MagicMock) -> None:
        artifact = self.create_preprod_artifact(
            project=self.project,
            date_added=before_now(days=100),
            date_expires=before_now(days=10),
            date_size_analysis_expires=before_now(days=10),
        )

        self.assert_expired(artifact, expired=True, size_analysis_expired=True)

    @patch("sentry.quotas.backend.get_event_retention", return_value=30)
    def test_artifact_without_expiry_follows_the_current_retention(
        self, mock_retention: MagicMock
    ) -> None:
        recent = self.create_preprod_artifact(project=self.project, date_added=before_now(days=10))
        old = self.create_preprod_artifact(project=self.project, date_added=before_now(days=60))

        self.assert_expired(recent, expired=False, size_analysis_expired=False)
        self.assert_expired(old, expired=False, size_analysis_expired=True)
