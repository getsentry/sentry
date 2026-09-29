from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.db import OperationalError, connections
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from sentry.hybridcloud.models.webhookpayload import WebhookPayload
from sentry.hybridcloud.tasks.webhook_backlog_metrics import (
    BACKLOG_AGE_QUERY_TIMEOUT,
    MAILBOX_DEPTH_QUERY_TIMEOUT,
    record_mailbox_depth_metrics,
    record_webhook_backlog_metrics,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.silo import control_silo_test

BACKLOG_ESTIMATE_METRIC = "hybridcloud.webhookpayload.backlog.pending_count_estimate"
BACKLOG_AGE_METRIC = "hybridcloud.webhookpayload.backlog.oldest_pending_age_seconds"
MAILBOX_PENDING_METRIC = "hybridcloud.webhookpayload.mailbox.pending_count"
MAILBOX_ACTIVE_METRIC = "hybridcloud.webhookpayload.mailbox.active_count"
MAILBOX_MAX_DEPTH_METRIC = "hybridcloud.webhookpayload.mailbox.max_depth"
MAILBOX_AGE_METRIC = "hybridcloud.webhookpayload.mailbox.oldest_pending_age_seconds"
MAILBOX_DEPTH_QUANTILE_METRIC = "hybridcloud.webhookpayload.mailbox.depth_quantile"


def create_payloads(num: int, mailbox: str, provider: str | None = None) -> None:
    for _ in range(0, num):
        Factories.create_webhook_payload(mailbox_name=mailbox, cell_name="us", provider=provider)


def gauge_calls(mock_metrics: MagicMock, key: str) -> list[tuple[float, dict[str, str]]]:
    """(value, tags) for every metrics.gauge call recorded under `key`."""
    return [
        (call[0][1], call[1].get("tags", {}))
        for call in mock_metrics.gauge.call_args_list
        if call[0][0] == key
    ]


def depth_quantiles(mock_metrics: MagicMock, provider: str) -> dict[str, float]:
    """{quantile: depth} reported for `provider`."""
    return {
        tags["quantile"]: value
        for value, tags in gauge_calls(mock_metrics, MAILBOX_DEPTH_QUANTILE_METRIC)
        if tags["provider"] == provider
    }


@control_silo_test
class WebhookBacklogMetricsTest(TestCase):
    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_reports_estimate_when_backlog_is_empty(self, mock_metrics: MagicMock) -> None:
        record_webhook_backlog_metrics()

        # The estimate must be emitted unconditionally: it is the only signal that
        # distinguishes a drained backlog from a task that has stopped running.
        assert len(gauge_calls(mock_metrics, BACKLOG_ESTIMATE_METRIC)) == 1
        # An age of zero would read as "caught up" rather than "nothing pending".
        assert gauge_calls(mock_metrics, BACKLOG_AGE_METRIC) == []

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_oldest_age_tracks_lowest_id_across_providers(self, mock_metrics: MagicMock) -> None:
        self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            provider="github",
            date_added=timezone.now() - timedelta(hours=3),
        )
        self.create_webhook_payload(
            mailbox_name="gitlab:789",
            cell_name="us",
            provider="gitlab",
            date_added=timezone.now() - timedelta(minutes=1),
        )

        record_webhook_backlog_metrics()

        ages = gauge_calls(mock_metrics, BACKLOG_AGE_METRIC)
        assert len(ages) == 1
        assert ages[0][0] == pytest.approx(timedelta(hours=3).total_seconds(), abs=60)

    def test_estimate_is_read_for_the_webhookpayload_table(self) -> None:
        # The pg_class lookup is raw SQL, so nothing else would catch it drifting off
        # the model's table — it would just return no row and skip the gauge.
        replica = WebhookPayload.objects.using_replica()

        with CaptureQueriesContext(connections[replica.db]) as queries:
            record_webhook_backlog_metrics()

        assert any(
            "pg_class" in q["sql"] and WebhookPayload._meta.db_table in q["sql"] for q in queries
        ), [q["sql"] for q in queries]

    def test_age_lookup_runs_under_a_statement_timeout(self) -> None:
        create_payloads(1, "github:123", provider="github")
        replica = WebhookPayload.objects.using_replica()

        with CaptureQueriesContext(connections[replica.db]) as queries:
            record_webhook_backlog_metrics()

        # Walking the primary key past delivery's dead index entries is not free, and
        # its cost follows vacuum lag rather than anything this task controls.
        timeout_ms = int(BACKLOG_AGE_QUERY_TIMEOUT.total_seconds() * 1000)
        assert any(
            "statement_timeout" in q["sql"] and str(timeout_ms) in q["sql"] for q in queries
        ), [q["sql"] for q in queries]

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_age_timeout_still_reports_the_estimate(self, mock_metrics: MagicMock) -> None:
        create_payloads(1, "github:123", provider="github")

        with patch(
            "sentry.hybridcloud.tasks.webhook_backlog_metrics.statement_timeout",
            side_effect=OperationalError("canceling statement due to statement timeout"),
        ):
            record_webhook_backlog_metrics()

        # Losing the age must not cost us the size signal, which needs no scan at all.
        assert len(gauge_calls(mock_metrics, BACKLOG_ESTIMATE_METRIC)) == 1
        assert gauge_calls(mock_metrics, BACKLOG_AGE_METRIC) == []
        mock_metrics.incr.assert_called_once_with(
            "hybridcloud.webhookpayload.backlog.age_query_failed", sample_rate=1.0
        )

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_missing_pg_class_row_skips_only_the_estimate(self, mock_metrics: MagicMock) -> None:
        # Simulates the raw pg_class lookup finding no catalog row for the table --
        # e.g. a replica connection where the relation isn't present under this
        # name. Must not emit a 0 (this gauge is host-tagged, so a 0 from one host
        # blends into every consumer's default aggregate and silently drags the
        # average down) -- and must not take out the unrelated age gauge below it,
        # which comes from an independent query. Only the first cursor (the raw
        # pg_class lookup) is faked; everything after -- including the age
        # lookup's own cursor use inside `statement_timeout` -- runs for real, so
        # a regression that coupled the two would fail this test rather than the
        # `db_table`-patching approach this replaced, which broke the age query
        # too and couldn't tell the difference.
        create_payloads(1, "github:123", provider="github")
        replica = WebhookPayload.objects.using_replica()
        real_cursor = connections[replica.db].cursor
        calls = {"n": 0}

        def fake_cursor(*args: object, **kwargs: object) -> object:
            calls["n"] += 1
            if calls["n"] == 1:
                mock_cursor = MagicMock()
                mock_cursor.__enter__.return_value = mock_cursor
                mock_cursor.__exit__.return_value = False
                mock_cursor.fetchone.return_value = None
                return mock_cursor
            return real_cursor(*args, **kwargs)

        with patch.object(connections[replica.db], "cursor", side_effect=fake_cursor):
            record_webhook_backlog_metrics()

        assert gauge_calls(mock_metrics, BACKLOG_ESTIMATE_METRIC) == []
        assert len(gauge_calls(mock_metrics, BACKLOG_AGE_METRIC)) == 1
        mock_metrics.incr.assert_called_once_with(
            "hybridcloud.webhookpayload.backlog.pending_count_query_failed", sample_rate=1.0
        )

    def test_oldest_age_lookup_does_not_scan(self) -> None:
        # A LIMIT-1 read in primary-key order is what keeps this task's cost flat as the
        # backlog grows; an aggregate over the unindexed date_added would not be.
        create_payloads(3, "github:123", provider="github")
        replica = WebhookPayload.objects.using_replica()

        with CaptureQueriesContext(connections[replica.db]) as queries:
            record_webhook_backlog_metrics()

        head_query = next(q["sql"] for q in queries if "date_added" in q["sql"])
        assert "LIMIT 1" in head_query
        assert "MIN(" not in head_query.upper()


@control_silo_test
class MailboxDepthMetricsTest(TestCase):
    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_depth_is_grouped_by_provider(self, mock_metrics: MagicMock) -> None:
        create_payloads(3, "github:123:push", provider="github")
        create_payloads(1, "github:456:push", provider="github")
        create_payloads(2, "jira:789", provider="jira")

        record_mailbox_depth_metrics()

        assert sorted(gauge_calls(mock_metrics, MAILBOX_PENDING_METRIC)) == [
            (2, {"provider": "jira", "event_type": "none"}),
            (4, {"provider": "github", "event_type": "push"}),
        ]
        # Only pending_count carries event_type; the rest would cost a series per
        # event type per control worker to say something they already say.
        assert sorted(gauge_calls(mock_metrics, MAILBOX_ACTIVE_METRIC)) == [
            (1, {"provider": "jira"}),
            (2, {"provider": "github"}),
        ]
        # The deepest github mailbox holds 3 of its 4 payloads.
        assert sorted(gauge_calls(mock_metrics, MAILBOX_MAX_DEPTH_METRIC)) == [
            (2, {"provider": "jira"}),
            (3, {"provider": "github"}),
        ]

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_gitlab_event_types_are_read_from_the_mailbox_name(
        self, mock_metrics: MagicMock
    ) -> None:
        create_payloads(2, "gitlab:123:4:merge_request", provider="gitlab")
        # Queued before gitlab mailboxed by event type, and still draining.
        create_payloads(1, "gitlab:123:4", provider="gitlab")

        record_mailbox_depth_metrics()

        assert sorted(gauge_calls(mock_metrics, MAILBOX_PENDING_METRIC)) == [
            (1, {"provider": "gitlab", "event_type": "unknown"}),
            (2, {"provider": "gitlab", "event_type": "merge_request"}),
        ]

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_null_provider_is_reported_as_unknown(self, mock_metrics: MagicMock) -> None:
        create_payloads(1, "github:123", provider=None)

        record_mailbox_depth_metrics()

        # No event type either: the provider column is the only thing that says whether
        # the mailbox name encodes one, and these legacy rows have none.
        assert gauge_calls(mock_metrics, MAILBOX_PENDING_METRIC) == [
            (1, {"provider": "unknown", "event_type": "none"})
        ]

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_bucketed_mailboxes_roll_up_within_an_event_type(self, mock_metrics: MagicMock) -> None:
        create_payloads(2, "github:123:7:pull_request", provider="github")
        create_payloads(1, "github:123:8:pull_request", provider="github")

        record_mailbox_depth_metrics()

        # Repository buckets are an implementation detail of parallel delivery, so they
        # collapse; the event type they carry does not.
        assert gauge_calls(mock_metrics, MAILBOX_PENDING_METRIC) == [
            (3, {"provider": "github", "event_type": "pull_request"})
        ]
        assert gauge_calls(mock_metrics, MAILBOX_ACTIVE_METRIC) == [(2, {"provider": "github"})]

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_event_types_are_reported_separately(self, mock_metrics: MagicMock) -> None:
        create_payloads(3, "github:123:7:check_run", provider="github")
        create_payloads(1, "github:123:7:push", provider="github")

        record_mailbox_depth_metrics()

        # The point of the dimension: one event type dominating the backlog is exactly
        # what the provider-only rollup hid, and what `github.webhook.forwarded_event`
        # is joined against to size a parser-side drop.
        assert sorted(gauge_calls(mock_metrics, MAILBOX_PENDING_METRIC)) == [
            (1, {"provider": "github", "event_type": "push"}),
            (3, {"provider": "github", "event_type": "check_run"}),
        ]

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_github_enterprise_mailboxes_carry_an_event_type(self, mock_metrics: MagicMock) -> None:
        # GithubEnterpriseRequestParser inherits get_mailbox, so its mailbox
        # names have the same shape.
        create_payloads(1, "github_enterprise:123:7:push", provider="github_enterprise")

        record_mailbox_depth_metrics()

        assert gauge_calls(mock_metrics, MAILBOX_PENDING_METRIC) == [
            (1, {"provider": "github_enterprise", "event_type": "push"})
        ]

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_unparseable_event_type_is_bounded(self, mock_metrics: MagicMock) -> None:
        # A delivery with no X-GitHub-Event header mailboxes without an event suffix,
        # leaving a bucket number where this reads. Tagging that verbatim would put an
        # unbounded id into the tag, so anything that isn't a known event is "unknown".
        create_payloads(1, "github:123:7", provider="github")

        record_mailbox_depth_metrics()

        assert gauge_calls(mock_metrics, MAILBOX_PENDING_METRIC) == [
            (1, {"provider": "github", "event_type": "unknown"})
        ]

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_control_only_event_names_are_not_trusted(self, mock_metrics: MagicMock) -> None:
        # Installation events are answered in control and never reach a cell mailbox, so
        # a mailbox claiming to hold them is not a name this task should report back.
        create_payloads(1, "github:123:7:installation", provider="github")

        record_mailbox_depth_metrics()

        assert gauge_calls(mock_metrics, MAILBOX_PENDING_METRIC) == [
            (1, {"provider": "github", "event_type": "unknown"})
        ]

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_oldest_age_is_per_provider(self, mock_metrics: MagicMock) -> None:
        self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            provider="github",
            date_added=timezone.now() - timedelta(hours=2),
        )
        self.create_webhook_payload(
            mailbox_name="github:456",
            cell_name="us",
            provider="github",
            date_added=timezone.now() - timedelta(minutes=1),
        )
        self.create_webhook_payload(
            mailbox_name="gitlab:789",
            cell_name="us",
            provider="gitlab",
            date_added=timezone.now() - timedelta(minutes=5),
        )

        record_mailbox_depth_metrics()

        ages = {
            tags["provider"]: value for value, tags in gauge_calls(mock_metrics, MAILBOX_AGE_METRIC)
        }
        assert ages["github"] == pytest.approx(timedelta(hours=2).total_seconds(), abs=60)
        assert ages["gitlab"] == pytest.approx(timedelta(minutes=5).total_seconds(), abs=60)

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_only_pending_count_is_tagged_by_event_type(self, mock_metrics: MagicMock) -> None:
        # Each event_type value costs a series per control worker on every metric that
        # carries it, so the dimension is confined to the one metric that needs it.
        create_payloads(1, "github:123:7:check_run", provider="github")
        create_payloads(1, "github:123:7:push", provider="github")

        record_mailbox_depth_metrics()

        for metric in (MAILBOX_ACTIVE_METRIC, MAILBOX_MAX_DEPTH_METRIC, MAILBOX_AGE_METRIC):
            assert [tags for _, tags in gauge_calls(mock_metrics, metric)] == [
                {"provider": "github"}
            ], metric
        assert all(
            "event_type" not in tags
            for _, tags in gauge_calls(mock_metrics, MAILBOX_DEPTH_QUANTILE_METRIC)
        )

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_depth_quantiles_describe_the_distribution(self, mock_metrics: MagicMock) -> None:
        for depth, mailbox in enumerate(("a", "b", "c", "d"), start=1):
            create_payloads(depth, f"github:{mailbox}:push", provider="github")

        # Nearest-rank over [1, 2, 3, 4].
        record_mailbox_depth_metrics()

        assert depth_quantiles(mock_metrics, "github") == {"p50": 2, "p90": 4, "p99": 4}

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_depth_quantiles_hold_for_a_single_mailbox(self, mock_metrics: MagicMock) -> None:
        create_payloads(5, "github:123:push", provider="github")

        record_mailbox_depth_metrics()

        # Covers the index clamp; a wrap to -1 is only visible in the test above.
        assert depth_quantiles(mock_metrics, "github") == {"p50": 5, "p90": 5, "p99": 5}

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_depth_quantiles_are_per_provider(self, mock_metrics: MagicMock) -> None:
        create_payloads(1, "github:1:push", provider="github")
        create_payloads(9, "github:2:push", provider="github")
        create_payloads(4, "gitlab:3", provider="gitlab")

        record_mailbox_depth_metrics()

        assert depth_quantiles(mock_metrics, "github") == {"p50": 1, "p90": 9, "p99": 9}
        assert depth_quantiles(mock_metrics, "gitlab") == {"p50": 4, "p90": 4, "p99": 4}

    def test_aggregate_runs_under_a_statement_timeout(self) -> None:
        create_payloads(1, "github:123", provider="github")
        replica = WebhookPayload.objects.using_replica()

        with CaptureQueriesContext(connections[replica.db]) as queries:
            record_mailbox_depth_metrics()

        # Without this the aggregate is unbounded, and it is the one backlog query
        # whose cost grows with the backlog it is meant to report on.
        timeout_ms = int(MAILBOX_DEPTH_QUERY_TIMEOUT.total_seconds() * 1000)
        assert any(
            "statement_timeout" in q["sql"] and str(timeout_ms) in q["sql"] for q in queries
        ), [q["sql"] for q in queries]

    @patch("sentry.hybridcloud.tasks.webhook_backlog_metrics.metrics")
    def test_aggregate_timeout_is_reported_and_does_not_raise(
        self, mock_metrics: MagicMock
    ) -> None:
        create_payloads(1, "github:123", provider="github")

        # A backlog deep enough to blow the statement timeout must cost us the
        # breakdown, not the task — record_webhook_backlog_metrics still reports.
        with patch(
            "sentry.hybridcloud.tasks.webhook_backlog_metrics.statement_timeout",
            side_effect=OperationalError("canceling statement due to statement timeout"),
        ):
            record_mailbox_depth_metrics()

        assert gauge_calls(mock_metrics, MAILBOX_PENDING_METRIC) == []
        mock_metrics.incr.assert_called_once_with(
            "hybridcloud.webhookpayload.mailbox.aggregate_failed", sample_rate=1.0
        )
