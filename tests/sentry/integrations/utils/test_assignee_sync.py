from datetime import UTC, datetime

from sentry.integrations.utils.assignee_sync import (
    get_stale_organization_ids,
    parse_provider_event_time,
    record_provider_event_time,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import cell_silo_test


class TestParseProviderEventTime:
    def test_github_format(self) -> None:
        assert parse_provider_event_time("2015-05-05T23:40:28Z") == datetime(
            2015, 5, 5, 23, 40, 28, tzinfo=UTC
        )

    def test_gitlab_format(self) -> None:
        assert parse_provider_event_time("2023-01-01 00:00:00 UTC") == datetime(
            2023, 1, 1, 0, 0, 0, tzinfo=UTC
        )

    def test_jira_format_keeps_offset(self) -> None:
        # Jira reports the instance's own offset, which must survive as absolute time.
        assert parse_provider_event_time("2023-01-01T02:00:00.000+0200") == datetime(
            2023, 1, 1, 0, 0, 0, tzinfo=UTC
        )

    def test_naive_timestamp_is_assumed_utc(self) -> None:
        assert parse_provider_event_time("2023-01-01T00:00:00") == datetime(
            2023, 1, 1, 0, 0, 0, tzinfo=UTC
        )

    def test_null_value(self) -> None:
        assert parse_provider_event_time(None) is None

    def test_blank_value(self) -> None:
        assert parse_provider_event_time("   ") is None

    def test_unparsable_value(self) -> None:
        assert parse_provider_event_time("not a timestamp") is None


@cell_silo_test
class TestAssigneeWatermark(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization, external_id="123456", provider="example"
        )
        self.external_issue = self.create_integration_external_issue(
            group=self.group, key="foo-123", integration=self.integration
        )

    def test_no_watermark_is_not_stale(self) -> None:
        assert self.external_issue.assignee_updated_at is None
        assert (
            get_stale_organization_ids(
                self.integration,
                "foo-123",
                [self.organization.id],
                datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC),
            )
            == set()
        )

    def test_missing_event_time_is_not_stale(self) -> None:
        record_provider_event_time(
            self.integration,
            "foo-123",
            [self.organization.id],
            datetime(2023, 1, 1, 0, 0, 5, tzinfo=UTC),
        )

        assert (
            get_stale_organization_ids(self.integration, "foo-123", [self.organization.id], None)
            == set()
        )

    def test_older_event_is_stale(self) -> None:
        record_provider_event_time(
            self.integration,
            "foo-123",
            [self.organization.id],
            datetime(2023, 1, 1, 0, 0, 5, tzinfo=UTC),
        )

        assert get_stale_organization_ids(
            self.integration,
            "foo-123",
            [self.organization.id],
            datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC),
        ) == {self.organization.id}

    def test_equal_event_is_not_stale(self) -> None:
        # Providers send the issue's full assignee snapshot, so re-applying a same-instant
        # event is idempotent for a redelivery and correct-by-recency for a distinct change
        # the provider's timestamp resolution can't separate.
        record_provider_event_time(
            self.integration,
            "foo-123",
            [self.organization.id],
            datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC),
        )

        assert (
            get_stale_organization_ids(
                self.integration,
                "foo-123",
                [self.organization.id],
                datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC),
            )
            == set()
        )

    def test_newer_event_is_not_stale(self) -> None:
        record_provider_event_time(
            self.integration,
            "foo-123",
            [self.organization.id],
            datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC),
        )

        assert (
            get_stale_organization_ids(
                self.integration,
                "foo-123",
                [self.organization.id],
                datetime(2023, 1, 1, 0, 0, 5, tzinfo=UTC),
            )
            == set()
        )

    def test_watermark_does_not_move_backwards(self) -> None:
        record_provider_event_time(
            self.integration,
            "foo-123",
            [self.organization.id],
            datetime(2023, 1, 1, 0, 0, 5, tzinfo=UTC),
        )
        record_provider_event_time(
            self.integration,
            "foo-123",
            [self.organization.id],
            datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC),
        )

        self.external_issue.refresh_from_db()
        assert self.external_issue.assignee_updated_at == datetime(2023, 1, 1, 0, 0, 5, tzinfo=UTC)

    def test_watermark_is_scoped_to_the_organizations_processed(self) -> None:
        other_org = self.create_organization()
        other_issue = self.create_integration_external_issue(
            group=self.create_group(project=self.create_project(organization=other_org)),
            key="foo-123",
            integration=self.integration,
        )

        record_provider_event_time(
            self.integration,
            "foo-123",
            [self.organization.id],
            datetime(2023, 1, 1, 0, 0, 5, tzinfo=UTC),
        )

        other_issue.refresh_from_db()
        assert other_issue.assignee_updated_at is None
        # The untouched organization is still free to apply the older event.
        assert get_stale_organization_ids(
            self.integration,
            "foo-123",
            [self.organization.id, other_org.id],
            datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC),
        ) == {self.organization.id}
