from datetime import UTC, datetime

from sentry.integrations.utils.status_sync import (
    is_stale_status_event,
    parse_provider_event_time,
)


class TestParseProviderEventTime:
    def test_github_format(self) -> None:
        assert parse_provider_event_time(
            {"provider_event_time": "2015-05-05T23:40:28Z"}
        ) == datetime(2015, 5, 5, 23, 40, 28, tzinfo=UTC)

    def test_gitlab_format(self) -> None:
        assert parse_provider_event_time(
            {"provider_event_time": "2023-01-01 00:00:00 UTC"}
        ) == datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC)

    def test_jira_format_keeps_offset(self) -> None:
        # Jira reports the instance's own offset, which must survive as absolute time.
        assert parse_provider_event_time(
            {"provider_event_time": "2023-01-01T02:00:00.000+0200"}
        ) == datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC)

    def test_vsts_format_with_padding(self) -> None:
        assert parse_provider_event_time(
            {"provider_event_time": "2018-07-05T23:23:09.493            Z"}
        ) == datetime(2018, 7, 5, 23, 23, 9, 493000, tzinfo=UTC)

    def test_naive_timestamp_is_assumed_utc(self) -> None:
        assert parse_provider_event_time(
            {"provider_event_time": "2023-01-01T00:00:00"}
        ) == datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC)

    def test_missing_key(self) -> None:
        assert parse_provider_event_time({"action": "closed"}) is None

    def test_null_value(self) -> None:
        assert parse_provider_event_time({"provider_event_time": None}) is None

    def test_blank_value(self) -> None:
        assert parse_provider_event_time({"provider_event_time": "   "}) is None

    def test_non_string_value(self) -> None:
        assert parse_provider_event_time({"provider_event_time": 1683330028}) is None

    def test_unparsable_value(self) -> None:
        assert parse_provider_event_time({"provider_event_time": "not a timestamp"}) is None


class TestIsStaleStatusEvent:
    def test_older_event_is_stale(self) -> None:
        assert is_stale_status_event(
            datetime(2023, 1, 1, 0, 0, 5, tzinfo=UTC), datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC)
        )

    def test_equal_event_is_stale(self) -> None:
        # A redelivery of an event we already applied must not run the sync again.
        assert is_stale_status_event(
            datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC), datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC)
        )

    def test_newer_event_is_not_stale(self) -> None:
        assert not is_stale_status_event(
            datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC), datetime(2023, 1, 1, 0, 0, 5, tzinfo=UTC)
        )

    def test_no_watermark_is_not_stale(self) -> None:
        assert not is_stale_status_event(None, datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC))

    def test_no_event_time_is_not_stale(self) -> None:
        assert not is_stale_status_event(datetime(2023, 1, 1, 0, 0, 0, tzinfo=UTC), None)
