import threading
import time
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import ANY, MagicMock, patch

import pytest
import responses
from django.core.cache import cache
from django.db import connections
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from requests.exceptions import ConnectionError, ReadTimeout

from sentry.hybridcloud.models.webhookpayload import (
    BACKOFF_INTERVAL,
    BACKOFF_RATE,
    MAX_ATTEMPTS,
    WebhookPayload,
)
from sentry.hybridcloud.tasks import deliver_webhooks
from sentry.hybridcloud.tasks.deliver_webhooks import (
    BATCH_SCHEDULE_OFFSET,
    DRAIN_LOCK_TTL,
    MAX_MAILBOX_DRAIN,
    RELEASE_MARGIN,
    SETTLE_ALLOWANCE,
    SLOW_DELIVERY_THRESHOLD,
    Dispatcher,
    _claim_and_dispatch,
    _due_mailbox_heads,
    drain_mailbox,
    maybe_trigger_drain,
    schedule_webhook_delivery,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell, CellResolutionError

cell_config = [Cell("us", 1, "http://us.testserver")]

# Drains invoked directly carry no dispatcher attribution; `_delivery_tags`
# tags them rather than omitting the key, so the tag stays queryable.
UNATTRIBUTED = {"dispatcher": "unknown"}

DELIVERY_METRIC = "hybridcloud.deliver_webhooks.delivery"
DELIVERY_TIME_METRIC = "hybridcloud.deliver_webhooks.delivery_time_ms"
DISPATCH_METRIC = "hybridcloud.deliver_webhooks.dispatch"
DISPATCH_CLAIMED_METRIC = "hybridcloud.deliver_webhooks.dispatch.claimed"
CAP_HEADROOM_METRIC = "hybridcloud.deliver_webhooks.drain.cap_headroom_seconds"
PUSH_TRIGGER_ERROR_METRIC = "hybridcloud.deliver_webhooks.push_trigger.error"
SCHEDULER_SKIPPED_METRIC = "hybridcloud.deliver_webhooks.scheduler.skipped"
DUE_ROWS_METRIC = "hybridcloud.schedule_webhook_delivery.due_rows"
IN_FLIGHT_ROWS_METRIC = "hybridcloud.schedule_webhook_delivery.in_flight_rows"
CYCLE_METRIC = "hybridcloud.schedule_webhook_delivery.cycle"
CARRYOVER_METRIC = "hybridcloud.schedule_webhook_delivery.carryover"
CARRYOVER_ERROR_METRIC = "hybridcloud.schedule_webhook_delivery.carryover.error"
CARRYOVER_DROPPED_METRIC = "hybridcloud.schedule_webhook_delivery.carryover.dropped"


class MetricCallsMixin:
    """Read `metrics.incr` / `metrics.distribution` calls off a patched module."""

    def tags_for(self, mock_metrics: MagicMock, metric: str) -> list[dict[str, str]]:
        """Tags of each `metrics.incr` call for `metric`, in call order."""
        return [c[1].get("tags", {}) for c in mock_metrics.incr.call_args_list if c[0][0] == metric]

    def incr_calls(self, mock_metrics: MagicMock, metric: str) -> list[tuple[int, dict[str, str]]]:
        """`(amount, tags)` of each `metrics.incr` call for `metric`, in call order."""
        return [
            (c[1].get("amount", 1), c[1].get("tags", {}))
            for c in mock_metrics.incr.call_args_list
            if c[0][0] == metric
        ]

    def distribution_calls(
        self, mock_metrics: MagicMock, metric: str
    ) -> list[tuple[float, dict[str, str]]]:
        """`(value, tags)` of each `metrics.distribution` call for `metric`."""
        return [
            (c[0][1], c[1].get("tags", {}))
            for c in mock_metrics.distribution.call_args_list
            if c[0][0] == metric
        ]

    def distribution_tags(self, mock_metrics: MagicMock, metric: str) -> list[dict[str, str]]:
        """Tags alone, where the recorded value is not what the test is about."""
        return [tags for _, tags in self.distribution_calls(mock_metrics, metric)]


DUE_HEAD_OPTIONS = {"hybridcloud.webhookpayload.dispatch_from_due_head": True}
cell_config_with_gateway = [
    Cell(
        name="us",
        snowflake_id=1,
        address="http://us.testserver",
        api_gateway_address="http://sentry-rpc-gateway",
    )
]


@control_silo_test
class ScheduleWebhooksTest(MetricCallsMixin, TestCase):
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_no_records(self, mock_deliver: MagicMock) -> None:
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 0

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_multiple_mailboxes(self, mock_deliver: MagicMock) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        webhook_two = self.create_webhook_payload(
            mailbox_name="github:256",
            cell_name="us",
        )
        assert webhook_one.schedule_for < timezone.now()
        assert webhook_two.schedule_for < timezone.now()

        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 2

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_one_mailbox_multiple_messages(self, mock_deliver: MagicMock) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 1
        mock_deliver.delay.assert_called_with(
            payload_id=webhook_one.id,
            claimed_count=2,
            dispatcher=Dispatcher.SCHEDULER,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_mailbox_scheduled_later(self, mock_deliver: MagicMock) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        self.create_webhook_payload(
            mailbox_name="github:256",
            cell_name="us",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 1
        mock_deliver.delay.assert_called_with(
            payload_id=webhook_one.id,
            claimed_count=1,
            dispatcher=Dispatcher.SCHEDULER,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_head_in_backoff_blocks_mailbox(self, mock_deliver: MagicMock) -> None:
        # The mailbox head (lowest id) is in a backoff window while a later
        # message is due. The whole mailbox must be skipped — scheduling the
        # later message would break head-of-line delivery ordering.
        self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )
        webhook_two = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        assert webhook_two.schedule_for < timezone.now()

        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 0

    @override_options(DUE_HEAD_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_due_head_dispatches_past_backoff_head(self, mock_deliver: MagicMock) -> None:
        # Head in backoff, later message due: due-head mode dispatches the due
        # message instead of gating the mailbox.
        backoff = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )
        due = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )

        schedule_webhook_delivery()

        mock_deliver.delay.assert_called_once_with(
            payload_id=due.id,
            claimed_count=1,
            dispatcher=Dispatcher.SCHEDULER,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )
        # The backing-off record keeps its retry schedule.
        backoff_schedule = backoff.schedule_for
        backoff.refresh_from_db()
        assert backoff.schedule_for == backoff_schedule

    @override_options(DUE_HEAD_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_due_head_strict_provider_still_gated(self, mock_deliver: MagicMock) -> None:
        # Jira is not skip-on-failure, so the head gate still applies.
        self.create_webhook_payload(
            mailbox_name="jira:123",
            cell_name="us",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )
        webhook_two = self.create_webhook_payload(
            mailbox_name="jira:123",
            cell_name="us",
        )
        assert webhook_two.schedule_for < timezone.now()

        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 0

    @override_options(DUE_HEAD_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_due_head_claim_stops_at_backoff_record(self, mock_deliver: MagicMock) -> None:
        # A backing-off record bounds the claim; records behind it wait.
        due_one = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        backoff = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )
        due_two = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        schedule_webhook_delivery()

        mock_deliver.delay.assert_called_once_with(
            payload_id=due_one.id,
            claimed_count=1,
            dispatcher=Dispatcher.SCHEDULER,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )
        backoff_schedule = backoff.schedule_for
        backoff.refresh_from_db()
        assert backoff.schedule_for == backoff_schedule
        # The due record past the backoff stays claimable for the next dispatch.
        due_two.refresh_from_db()
        assert due_two.schedule_for < timezone.now()

    @override_options(DUE_HEAD_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_due_head_does_not_reclaim_active_drain(self, mock_deliver: MagicMock) -> None:
        # A backoff expiring behind an in-flight drain's claim must not sweep
        # that claim into a second drain.
        expired_backoff = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        claimed = create_payloads(3, "github:123")
        WebhookPayload.objects.filter(id__in=[record.id for record in claimed]).update(
            schedule_for=timezone.now() + timedelta(minutes=2)
        )

        schedule_webhook_delivery()

        mock_deliver.delay.assert_called_once_with(
            payload_id=expired_backoff.id,
            claimed_count=1,
            dispatcher=Dispatcher.SCHEDULER,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )

    @override_options(DUE_HEAD_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_due_head_nothing_due(self, mock_deliver: MagicMock) -> None:
        self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 0

    @override_options(DUE_HEAD_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_due_head_prioritizes_by_provider(self, mock_deliver: MagicMock) -> None:
        github_webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            provider="github",
            cell_name="us",
        )
        stripe_webhook = self.create_webhook_payload(
            mailbox_name="stripe:123",
            provider="stripe",
            cell_name="us",
        )

        schedule_webhook_delivery()

        assert mock_deliver.delay.call_count == 2
        call_args_list = [call.kwargs["payload_id"] for call in mock_deliver.delay.call_args_list]
        assert call_args_list == [stripe_webhook.id, github_webhook.id]

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_updates_mailbox_attributes(self, mock_deliver: MagicMock) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        webhook_two = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        schedule_webhook_delivery()

        webhook_one.refresh_from_db()
        webhook_two.refresh_from_db()
        # Scheduler should move all messages forward
        assert webhook_one.attempts == 0
        assert webhook_one.schedule_for > timezone.now()
        assert webhook_two.attempts == 0
        assert webhook_two.schedule_for > timezone.now()

        assert mock_deliver.delay.call_count == 1
        mock_deliver.delay.assert_called_with(
            payload_id=webhook_one.id,
            claimed_count=2,
            dispatcher=Dispatcher.SCHEDULER,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )

    @responses.activate
    @override_cells(cell_config)
    def test_schedule_mailbox_with_more_than_batch_size_records(self) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/jira/webhook/", body=ReadTimeout()
        )
        num_records = 55
        for _ in range(0, num_records):
            self.create_webhook_payload(
                mailbox_name="jira:123",
                cell_name="us",
                provider="jira",
                request_path="/extensions/jira/webhook/",
            )
        # Run the task that is spawned to provide some integration test coverage.
        with self.tasks():
            schedule_webhook_delivery()

        # First attempt fails. jira is not in the skip-on-failure allowlist so
        # processing stops after the first message, preserving mailbox ordering.
        assert len(responses.calls) == 1
        assert WebhookPayload.objects.count() == num_records
        head = WebhookPayload.objects.all().order_by("id").first()
        assert head
        assert head.schedule_for > timezone.now()

        # Do another scheduled run. This should not make any forwarding requests
        # because the head is still in backoff.
        with self.tasks():
            schedule_webhook_delivery()
        assert len(responses.calls) == 1
        # Head doesn't move.
        new_head = WebhookPayload.objects.all().order_by("id").first()
        assert new_head
        assert head.schedule_for == new_head.schedule_for

        # No messages delivered
        assert WebhookPayload.objects.count() == num_records

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_deep_mailbox_dispatches_once(self, mock_deliver: MagicMock) -> None:
        for _ in range(0, int(MAX_MAILBOX_DRAIN / 3 + 1)):
            self.create_webhook_payload(
                mailbox_name="github:123",
                cell_name="us",
            )
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 1

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_claim_and_dispatch_skips_head_claimed_on_primary(self, mock_drain: MagicMock) -> None:
        # The scheduler discovers mailbox heads on the replica, which can lag behind
        # another dispatcher's claim on the primary. The primary re-check must stop
        # the stale head from double-dispatching a drain.
        claimed_for = timezone.now() + timedelta(minutes=3)
        webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            schedule_for=claimed_for,
        )

        claim = _claim_and_dispatch(
            webhook.id, webhook.mailbox_name, dispatcher=Dispatcher.SCHEDULER
        )

        assert claim is None
        mock_drain.delay.assert_not_called()
        webhook.refresh_from_db()
        # The existing claim must not be extended either.
        assert webhook.schedule_for == claimed_for

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_claim_and_dispatch_claims_in_a_single_query(self, mock_drain: MagicMock) -> None:
        # The due-gate rides in the claim UPDATE's WHERE clause. A separate
        # primary read before the claim would double the per-mailbox dispatch
        # round trips, so lock in the single-statement shape.
        webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )

        with CaptureQueriesContext(connections["control"]) as ctx:
            claim = _claim_and_dispatch(
                webhook.id, webhook.mailbox_name, dispatcher=Dispatcher.SCHEDULER
            )

        assert claim is not None
        assert claim.claimed == 1
        mock_drain.delay.assert_called_once_with(
            payload_id=webhook.id,
            claimed_count=1,
            dispatcher=Dispatcher.SCHEDULER,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )
        # Option reads are served from the option store's cache in production,
        # so only payload-table statements count toward the round-trip budget.
        queries = [
            q["sql"] for q in ctx.captured_queries if "hybridcloud_webhookpayload" in q["sql"]
        ]
        assert len(queries) == 1, queries
        assert "UPDATE" in queries[0]
        assert "EXISTS" in queries[0]
        webhook.refresh_from_db()
        assert webhook.schedule_for > timezone.now()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @patch(
        "sentry.hybridcloud.tasks.deliver_webhooks.PROVIDER_PRIORITY",
        {"stripe": 1, "github": 2, "slack": 3},
    )
    def test_schedule_prioritizes_by_provider(self, mock_deliver: MagicMock) -> None:
        """Test that webhooks are prioritized based on provider priority."""
        # Create webhooks with different providers (intentionally in non-priority order)
        slack_webhook = self.create_webhook_payload(
            mailbox_name="slack:123",
            provider="slack",
            cell_name="us",
        )
        github_webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            provider="github",
            cell_name="us",
        )
        stripe_webhook = self.create_webhook_payload(
            mailbox_name="stripe:123",
            provider="stripe",
            cell_name="us",
        )

        # Run the scheduler
        schedule_webhook_delivery()

        # Verify webhooks were processed in priority order (stripe first, then github, then slack)
        assert mock_deliver.delay.call_count == 3
        # Check the order of calls
        call_args_list = [call.kwargs["payload_id"] for call in mock_deliver.delay.call_args_list]

        # Stripe (priority 1) should be first
        assert call_args_list[0] == stripe_webhook.id
        # GitHub (priority 2) should be second
        assert call_args_list[1] == github_webhook.id
        # Slack (priority 3) should be last
        assert call_args_list[2] == slack_webhook.id

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @patch(
        "sentry.hybridcloud.tasks.deliver_webhooks.PROVIDER_PRIORITY", {"stripe": 1, "github": 2}
    )
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.DEFAULT_PROVIDER_PRIORITY", 10)
    def test_schedule_handles_unknown_providers(self, mock_deliver: MagicMock) -> None:
        """Test that webhooks with unknown providers use the default priority."""
        # Create webhooks with known and unknown providers
        unknown_webhook = self.create_webhook_payload(
            mailbox_name="unknown:123",
            provider="unknown",
            cell_name="us",
        )
        stripe_webhook = self.create_webhook_payload(
            mailbox_name="stripe:123",
            provider="stripe",
            cell_name="us",
        )

        # Run the scheduler
        schedule_webhook_delivery()

        # Verify webhooks were processed in priority order (stripe first, then unknown)
        assert mock_deliver.delay.call_count == 2
        # Check the order of calls
        call_args_list = [call.kwargs["payload_id"] for call in mock_deliver.delay.call_args_list]

        # Stripe (priority 1) should be first
        assert call_args_list[0] == stripe_webhook.id
        # Unknown (default priority 10) should be last
        assert call_args_list[1] == unknown_webhook.id

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @patch(
        "sentry.hybridcloud.tasks.deliver_webhooks.PROVIDER_PRIORITY", {"stripe": 1, "github": 2}
    )
    def test_schedule_handles_null_provider(self, mock_deliver: MagicMock) -> None:
        """Test that webhooks with null provider field use the default priority."""
        # Create webhooks - one with a provider field, one with null provider

        # Create webhook with null provider
        null_provider_webhook = WebhookPayload.objects.create(
            mailbox_name="github:456",
            provider=None,
            cell_name="us",
            request_method="POST",
            request_path="/webhook/",
            request_headers="{}",
            request_body="{}",
        )

        # Create webhook with stripe provider
        stripe_webhook = self.create_webhook_payload(
            mailbox_name="stripe:123",
            provider="stripe",
            cell_name="us",
        )

        # Run the scheduler
        schedule_webhook_delivery()

        # Verify webhooks were processed in priority order (stripe first, then null provider)
        assert mock_deliver.delay.call_count == 2
        # Check the order of calls
        call_args_list = [call.kwargs["payload_id"] for call in mock_deliver.delay.call_args_list]

        # Stripe (priority 1) should be first
        assert call_args_list[0] == stripe_webhook.id
        # Null provider (default priority) should be last
        assert call_args_list[1] == null_provider_webhook.id

    def scheduler_skips(self, mock_metrics: MagicMock) -> list[dict[str, str]]:
        return self.tags_for(mock_metrics, SCHEDULER_SKIPPED_METRIC)

    @patch.object(deliver_webhooks, "BATCH_SIZE", 2)
    @patch.object(deliver_webhooks, "BATCH_SELECT_LIMIT", 4)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_overselect_covers_mailboxes_lost_to_other_dispatchers(
        self, mock_drain: MagicMock
    ) -> None:
        webhooks = [
            self.create_webhook_payload(mailbox_name=f"github:{i}", cell_name="us")
            for i in range(3)
        ]
        # A dispatcher is mid-claim on the first mailbox; the surplus select must
        # let the cycle still reach its dispatch target.
        cache.set(f"wh:drain_active:{webhooks[0].mailbox_name}", 1, timeout=DRAIN_LOCK_TTL)

        schedule_webhook_delivery()

        dispatched = [call.kwargs["payload_id"] for call in mock_drain.delay.call_args_list]
        assert dispatched == [webhooks[1].id, webhooks[2].id]

    @patch.object(deliver_webhooks, "BATCH_SIZE", 2)
    @patch.object(deliver_webhooks, "BATCH_SELECT_LIMIT", 4)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_stops_at_dispatch_target(self, mock_drain: MagicMock) -> None:
        webhooks = [
            self.create_webhook_payload(mailbox_name=f"github:{i}", cell_name="us")
            for i in range(3)
        ]

        schedule_webhook_delivery()

        dispatched = [call.kwargs["payload_id"] for call in mock_drain.delay.call_args_list]
        assert dispatched == [webhooks[0].id, webhooks[1].id]
        # The surplus head is untouched — still due for the next cycle.
        webhooks[2].refresh_from_db()
        assert webhooks[2].schedule_for <= timezone.now()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_records_lock_skip(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        cache.set(f"wh:drain_active:{webhook.mailbox_name}", 1, timeout=DRAIN_LOCK_TTL)

        schedule_webhook_delivery()

        assert mock_drain.delay.call_count == 0
        assert self.scheduler_skips(mock_metrics) == [{"provider": "github", "reason": "lock_held"}]

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch(
        "sentry.hybridcloud.tasks.deliver_webhooks._claim_mailbox_batch",
        return_value=None,
    )
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_records_claim_lost(
        self, mock_drain: MagicMock, mock_claim: MagicMock, mock_metrics: MagicMock
    ) -> None:
        # Another dispatcher claimed the head between this cycle's discovery and
        # its own claim, so the claim finds nothing due.
        self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        schedule_webhook_delivery()

        assert mock_drain.delay.call_count == 0
        assert self.scheduler_skips(mock_metrics) == [
            {"provider": "github", "reason": "claim_lost"}
        ]


class CarryoverTestBase(MetricCallsMixin, TestCase):
    """Mailbox setup and cache reads shared by the carryover suites."""

    def create_mailboxes(self, count: int) -> list[WebhookPayload]:
        return [
            self.create_webhook_payload(mailbox_name=f"github:{index}", cell_name="us")
            for index in range(count)
        ]

    def failing_cache(self, method: str) -> MagicMock:
        """A cache whose `method` raises; every other call reaches the real one."""
        double = MagicMock(wraps=cache)
        getattr(double, method).side_effect = Exception("cache unavailable")
        return double

    def carryover(self) -> list[dict[str, Any]] | None:
        return cache.get(deliver_webhooks.CARRYOVER_CACHE_KEY)

    def dispatched_ids(self, mock_drain: MagicMock) -> list[int]:
        return [call.kwargs["payload_id"] for call in mock_drain.delay.call_args_list]

    def carried(self, webhooks: list[WebhookPayload]) -> list[dict[str, Any]]:
        return [{"id": w.id, "mailbox_name": w.mailbox_name} for w in webhooks]


@control_silo_test
@patch.object(deliver_webhooks, "BATCH_SIZE", 2)
@patch.object(deliver_webhooks, "BATCH_SELECT_LIMIT", 4)
class ScheduleCarryoverTest(CarryoverTestBase):
    """
    Cycles dispatch two mailboxes apiece here, so a third mailbox is the surplus a
    cycle discovers but has no budget to dispatch. A one-head surplus sits exactly
    on the `BATCH_SIZE // 2` floor here, so it is kept.
    """

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_surplus_heads_are_stored(self, mock_drain: MagicMock, mock_metrics: MagicMock) -> None:
        webhooks = self.create_mailboxes(3)
        double = MagicMock(wraps=cache)

        with patch.object(deliver_webhooks, "cache", double):
            schedule_webhook_delivery()

        assert self.dispatched_ids(mock_drain) == [webhooks[0].id, webhooks[1].id]
        double.set.assert_called_once_with(
            deliver_webhooks.CARRYOVER_CACHE_KEY,
            [{"id": webhooks[2].id, "mailbox_name": webhooks[2].mailbox_name}],
            timeout=deliver_webhooks.CARRYOVER_TTL,
        )
        assert self.distribution_calls(mock_metrics, CARRYOVER_METRIC) == [(1, {})]

    @override_options(DUE_HEAD_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_due_head_discovery_carries_its_surplus_too(self, mock_drain: MagicMock) -> None:
        webhooks = self.create_mailboxes(3)

        schedule_webhook_delivery()

        assert self.dispatched_ids(mock_drain) == [webhooks[0].id, webhooks[1].id]
        assert self.carryover() == [
            {"id": webhooks[2].id, "mailbox_name": webhooks[2].mailbox_name}
        ]

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_carried_heads_dispatch_without_discovery(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhooks = self.create_mailboxes(3)
        schedule_webhook_delivery()
        mock_drain.delay.reset_mock()

        with (
            patch.object(deliver_webhooks, "_gated_mailbox_heads") as mock_gated,
            patch.object(deliver_webhooks, "_due_mailbox_heads") as mock_due,
        ):
            schedule_webhook_delivery()

        mock_gated.assert_not_called()
        mock_due.assert_not_called()
        assert self.dispatched_ids(mock_drain) == [webhooks[2].id]
        assert self.tags_for(mock_metrics, CYCLE_METRIC) == [
            {"source": "discovery"},
            {"source": "carryover"},
        ]

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_discovery_resumes_once_the_surplus_is_spent(self, mock_drain: MagicMock) -> None:
        self.create_mailboxes(3)
        schedule_webhook_delivery()
        schedule_webhook_delivery()
        assert self.carryover() is None

        with patch.object(deliver_webhooks, "_gated_mailbox_heads", return_value=[]) as mock_gated:
            schedule_webhook_delivery()

        mock_gated.assert_called_once()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_stale_carried_head_claims_nothing(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhooks = self.create_mailboxes(3)
        schedule_webhook_delivery()
        mock_drain.delay.reset_mock()
        # Another dispatcher claimed the carried head between the two cycles. The
        # claim's due-gate is what makes carrying a head safe, so the cycle must
        # spend one claim attempt on it and move on.
        WebhookPayload.objects.filter(id=webhooks[2].id).update(
            schedule_for=timezone.now() + timedelta(hours=1)
        )

        schedule_webhook_delivery()

        mock_drain.delay.assert_not_called()
        assert self.tags_for(mock_metrics, SCHEDULER_SKIPPED_METRIC) == [
            {"provider": "github", "reason": "claim_lost"}
        ]
        assert self.carryover() is None

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_cache_read_failure_falls_back_to_discovery(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        self.create_mailboxes(3)
        schedule_webhook_delivery()

        with patch.object(deliver_webhooks, "cache", self.failing_cache("get")):
            schedule_webhook_delivery()

        assert self.tags_for(mock_metrics, CYCLE_METRIC) == [
            {"source": "discovery"},
            {"source": "discovery"},
        ]
        assert self.tags_for(mock_metrics, CARRYOVER_ERROR_METRIC) == [{"operation": "get"}]

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_cache_write_failure_leaves_the_cycle_intact(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhooks = self.create_mailboxes(3)

        with patch.object(deliver_webhooks, "cache", self.failing_cache("set")):
            schedule_webhook_delivery()

        assert self.dispatched_ids(mock_drain) == [webhooks[0].id, webhooks[1].id]
        assert self.tags_for(mock_metrics, CARRYOVER_ERROR_METRIC) == [{"operation": "set"}]
        assert self.carryover() is None

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_cache_delete_failure_leaves_the_cycle_intact(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhooks = self.create_mailboxes(3)
        schedule_webhook_delivery()
        mock_drain.delay.reset_mock()

        with patch.object(deliver_webhooks, "cache", self.failing_cache("delete")):
            schedule_webhook_delivery()

        assert self.dispatched_ids(mock_drain) == [webhooks[2].id]
        assert self.tags_for(mock_metrics, CARRYOVER_ERROR_METRIC) == [{"operation": "delete"}]

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_cycle_within_budget_carries_nothing(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        self.create_mailboxes(2)

        schedule_webhook_delivery()

        assert self.carryover() is None
        assert self.distribution_calls(mock_metrics, CARRYOVER_METRIC) == []
        assert self.tags_for(mock_metrics, CYCLE_METRIC) == [{"source": "discovery"}]


@control_silo_test
@patch.object(deliver_webhooks, "BATCH_SIZE", 4)
@patch.object(deliver_webhooks, "BATCH_SELECT_LIMIT", 12)
class ScheduleCarryoverFloorTest(CarryoverTestBase):
    """A surplus under `BATCH_SIZE // 2` is dropped rather than carried."""

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_surplus_below_the_floor_is_dropped(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        self.create_mailboxes(5)

        schedule_webhook_delivery()

        assert self.carryover() is None
        assert self.tags_for(mock_metrics, CARRYOVER_DROPPED_METRIC) == [{}]
        assert self.distribution_calls(mock_metrics, CARRYOVER_METRIC) == []

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_surplus_at_the_floor_is_carried(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhooks = self.create_mailboxes(6)

        schedule_webhook_delivery()

        assert self.carryover() == self.carried(webhooks[4:])
        assert self.tags_for(mock_metrics, CARRYOVER_DROPPED_METRIC) == []

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_carryover_spent_below_the_floor_is_cleared(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhooks = self.create_mailboxes(9)
        schedule_webhook_delivery()
        assert self.carryover() == self.carried(webhooks[4:])

        # A stale carryover would displace the next cycle's discovery.
        schedule_webhook_delivery()

        assert self.carryover() is None
        assert self.tags_for(mock_metrics, CARRYOVER_DROPPED_METRIC) == [{}]


@control_silo_test
class DueHeadDepthTest(MetricCallsMixin, TestCase):
    """
    Discovery reports what sits in each mailbox, not just which are due: a mailbox
    count cannot tell one record per mailbox from a thousand.
    """

    def rows_by_provider(self, mock_metrics: MagicMock, metric: str) -> dict[str, float]:
        """The value recorded per provider, keyed so emission order doesn't matter."""
        return {
            tags["provider"]: value for value, tags in self.distribution_calls(mock_metrics, metric)
        }

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_claimed_and_backing_off_rows_are_both_in_flight(self, mock_metrics: MagicMock) -> None:
        due = create_payloads(2, "github:123", provider="github")
        claimed = create_payloads(3, "github:123", provider="github")
        WebhookPayload.objects.filter(id__in=[record.id for record in claimed]).update(
            schedule_for=timezone.now() + BATCH_SCHEDULE_OFFSET
        )
        self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            provider="github",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )

        heads = _due_mailbox_heads()

        # The head is the oldest due record, not the mailbox's true head.
        assert heads == [{"id": due[0].id, "mailbox_name": "github:123"}]
        # Claimed rows and the backing-off row are both in flight: neither is
        # available to this cycle's dispatch.
        assert self.rows_by_provider(mock_metrics, DUE_ROWS_METRIC) == {"github": 2}
        assert self.rows_by_provider(mock_metrics, IN_FLIGHT_ROWS_METRIC) == {"github": 4}

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_depth_summed_per_provider(self, mock_metrics: MagicMock) -> None:
        create_payloads(2, "github:123", provider="github")
        create_payloads(1, "github:456", provider="github")
        jira = create_payloads(3, "jira:123", provider="jira")
        WebhookPayload.objects.filter(id=jira[-1].id).update(
            schedule_for=timezone.now() + BATCH_SCHEDULE_OFFSET
        )

        _due_mailbox_heads()

        assert self.rows_by_provider(mock_metrics, DUE_ROWS_METRIC) == {"github": 3, "jira": 2}
        assert self.rows_by_provider(mock_metrics, IN_FLIGHT_ROWS_METRIC) == {
            "github": 0,
            "jira": 1,
        }

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_depth_counts_mailboxes_that_cannot_dispatch(self, mock_metrics: MagicMock) -> None:
        # An undispatchable mailbox is still backlog worth seeing.
        self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            provider="github",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )
        # jira is strict-ordering: a claimed head gates the due rows behind it.
        self.create_webhook_payload(
            mailbox_name="jira:123",
            cell_name="us",
            provider="jira",
            schedule_for=timezone.now() + BATCH_SCHEDULE_OFFSET,
        )
        create_payloads(2, "jira:123", provider="jira")

        assert _due_mailbox_heads() == []

        assert self.rows_by_provider(mock_metrics, DUE_ROWS_METRIC) == {"github": 0, "jira": 2}
        assert self.rows_by_provider(mock_metrics, IN_FLIGHT_ROWS_METRIC) == {
            "github": 1,
            "jira": 1,
        }


def fresh_deadline() -> float:
    """A live claim deadline for drains invoked directly, without a dispatcher."""
    return (timezone.now() + BATCH_SCHEDULE_OFFSET).timestamp()


def create_payloads(num: int, mailbox: str, provider: str | None = None) -> list[WebhookPayload]:
    # Keep path aligned with provider so responses mocks aren't misleading.
    request_path = f"/extensions/{provider}/webhook/" if provider else "/extensions/github/webhook/"
    created = []
    for _ in range(0, num):
        hook = Factories.create_webhook_payload(
            mailbox_name=mailbox,
            cell_name="us",
            provider=provider,
            request_path=request_path,
        )
        created.append(hook)
    return created


class ConcurrencyProbe:
    """A `deliver_message` stand-in that records how many deliveries overlapped."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._in_progress = 0
        self.value = 0

    def deliver(self, payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
        with self._lock:
            self._in_progress += 1
            self.value = max(self.value, self._in_progress)
        # Long enough for every pool thread to be inside here at once.
        time.sleep(0.2)
        with self._lock:
            self._in_progress -= 1
        return (payload, None)


def assert_drain_skips_failed_message(provider: str) -> None:
    """
    Drain a 5 message mailbox where the second delivery fails.

    Asserts the provider is allowlisted in
    `hybridcloud.webhookpayload.skip_on_failure_providers`: every message is
    attempted and only the failed one is left behind for a later retry. The
    provider string is used verbatim for `WebhookPayload.provider`, so a value
    that doesn't match the registered default fails here instead of silently
    behaving as a non-allowlisted provider.
    """
    url = f"http://us.testserver/extensions/{provider}/webhook/"
    responses.add(responses.POST, url, status=200, body="")
    responses.add(responses.POST, url, status=500, body="")
    responses.add(responses.POST, url, status=200, body="")
    responses.add(responses.POST, url, status=200, body="")
    responses.add(responses.POST, url, status=200, body="")
    records = create_payloads(5, f"{provider}:123", provider=provider)

    drain_mailbox(
        records[0].id,
        claimed_count=MAX_MAILBOX_DRAIN,
        valid_until=fresh_deadline(),
        mailbox=f"{provider}:123",
    )

    assert len(responses.calls) == 5
    assert WebhookPayload.objects.count() == 1

    remaining = WebhookPayload.objects.get()
    assert remaining.provider == provider
    assert remaining.attempts == 1
    assert remaining.schedule_for > timezone.now()


@control_silo_test
class DrainMailboxTest(MetricCallsMixin, TestCase):
    @responses.activate
    def test_drain_missing_payload(self) -> None:
        drain_mailbox(99, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123")
        assert len(responses.calls) == 0

    @responses.activate
    def test_drain_unknown_region(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="lolnope",
        )
        with pytest.raises(CellResolutionError):
            drain_mailbox(
                webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
            )
        assert len(responses.calls) == 0

    @responses.activate
    @override_cells(cell_config)
    def test_drain_success_partial(self) -> None:
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=500, body="")
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(5, "github:123", provider="github")
        drain_mailbox(
            records[0].id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        # github is in the skip-on-failure allowlist: failed messages are skipped
        # and processing continues. All 5 messages are attempted.
        assert len(responses.calls) == 5

        # Only the failed message remains in the mailbox.
        assert WebhookPayload.objects.count() == 1

        # Failed record should be scheduled to run later.
        first = WebhookPayload.objects.order_by("id").first()
        assert first
        assert first.attempts == 1
        assert first.schedule_for > timezone.now()

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 1})
    def test_drain_stops_at_claimed_count(self) -> None:
        # A claim-mode drain holds no lock while running: delivering past its
        # claimed records would race a drain another dispatcher may have started
        # for the (due-again) mailbox head. It must stop at the claim boundary.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(8, "github:123", provider="github")

        drain_mailbox(
            records[0].id, claimed_count=5, valid_until=fresh_deadline(), mailbox="github:123"
        )

        assert len(responses.calls) == 5
        remaining = set(WebhookPayload.objects.values_list("id", flat=True))
        assert remaining == {records[5].id, records[6].id, records[7].id}

    @responses.activate
    @override_cells(cell_config)
    @patch.object(deliver_webhooks, "MAX_MAILBOX_DRAIN", 3)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_claim_at_the_cap_records_its_unused_window(self, mock_metrics: MagicMock) -> None:
        # The cap ended this drain with a minute of delivery time unspent: rows
        # the mailbox still holds could have gone out under this claim.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(4, "github:123", provider="github")
        valid_until = timezone.now() + RELEASE_MARGIN + timedelta(seconds=60)

        drain_mailbox(
            records[0].id,
            claimed_count=3,
            valid_until=valid_until.timestamp(),
            mailbox="github:123",
        )

        assert len(responses.calls) == 3
        ((amount, tags),) = self.incr_calls(mock_metrics, CAP_HEADROOM_METRIC)
        assert tags == {**UNATTRIBUTED, "provider": "github"}
        # Mocked deliveries take milliseconds, leaving the window all but whole.
        assert 55 <= amount <= 60

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_claim_below_the_cap_records_no_unused_window(self, mock_metrics: MagicMock) -> None:
        # A claim the cap never bound took every record that was due, so its
        # leftover window measures the mailbox's depth rather than the cap's cost.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(4, "github:123", provider="github")

        drain_mailbox(
            records[0].id, claimed_count=3, valid_until=fresh_deadline(), mailbox="github:123"
        )

        assert len(responses.calls) == 3
        assert self.incr_calls(mock_metrics, CAP_HEADROOM_METRIC) == []

    @responses.activate
    @override_cells(cell_config)
    def test_drain_stops_at_claimed_count_concurrently(self) -> None:
        # The claim boundary binds concurrent delivery too, not only the in-order walk.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(8, "github:123", provider="github")

        drain_mailbox(
            records[0].id, claimed_count=6, valid_until=fresh_deadline(), mailbox="github:123"
        )

        assert len(responses.calls) == 6
        remaining = set(WebhookPayload.objects.values_list("id", flat=True))
        assert remaining == {records[6].id, records[7].id}

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 0})
    def test_drain_survives_zero_worker_threads(self) -> None:
        # The option is operator-editable; a zero must degrade to one thread, not
        # fail every drain of the provider until the claim horizon, and again.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(3, "github:123", provider="github")

        drain_mailbox(
            records[0].id, claimed_count=3, valid_until=fresh_deadline(), mailbox="github:123"
        )

        assert len(responses.calls) == 3
        assert WebhookPayload.objects.count() == 0

    @override_cells(cell_config)
    def test_strict_provider_spends_the_attempt_before_the_request(self) -> None:
        # A drain killed mid-request leaves no result to reschedule on. A strict
        # provider's record would head-block its mailbox on every retry at the
        # claim horizon, so it carries the attempt when the request goes out —
        # and is not charged a second one when the request then fails.
        record = create_payloads(1, "jira:123", provider="jira")[0]
        attempts_at_request: list[int] = []

        def deliver(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
            attempts_at_request.append(payload.attempts)
            return (payload, deliver_webhooks.DeliveryFailed())

        with patch.object(deliver_webhooks, "deliver_message", side_effect=deliver):
            drain_mailbox(
                record.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="jira:123"
            )

        assert attempts_at_request == [1]
        record.refresh_from_db()
        assert record.attempts == 1
        assert record.schedule_for > timezone.now()

    @override_cells(cell_config)
    def test_skip_on_failure_provider_spends_the_attempt_on_the_result(self) -> None:
        # The high-volume providers are spared the extra write per record: their
        # attempt is spent only when a request comes back failed.
        record = create_payloads(1, "github:123", provider="github")[0]
        attempts_at_request: list[int] = []

        def deliver(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
            attempts_at_request.append(payload.attempts)
            return (payload, deliver_webhooks.DeliveryFailed())

        with patch.object(deliver_webhooks, "deliver_message", side_effect=deliver):
            drain_mailbox(
                record.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
            )

        assert attempts_at_request == [0]
        record.refresh_from_db()
        assert record.attempts == 1
        assert record.schedule_for > timezone.now()

    @override_cells(cell_config)
    def test_unexpected_delivery_error_does_not_abandon_in_flight_deliveries(self) -> None:
        # An unexpected error surfaces from the drain, but only after every
        # in-flight result is handled: a sibling delivered on another thread must
        # still be deleted, or a later claim would redeliver it.
        records = create_payloads(4, "github:123", provider="github")

        def deliver(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
            if payload.id == records[0].id:
                return (payload, ValueError("boom"))
            # Complete after the error's result is already being handled.
            time.sleep(0.2)
            return (payload, None)

        with patch.object(deliver_webhooks, "deliver_message", side_effect=deliver):
            with pytest.raises(ValueError):
                drain_mailbox(
                    records[0].id,
                    claimed_count=4,
                    valid_until=fresh_deadline(),
                    mailbox="github:123",
                )

        remaining = set(WebhookPayload.objects.values_list("id", flat=True))
        # The delivered sibling is gone; the errored head keeps its retry.
        assert records[1].id not in remaining
        assert records[0].id in remaining

    @responses.activate
    @override_cells(cell_config)
    def test_drain_stale_discards_consume_claim_budget(self) -> None:
        # Stale rows are discarded where they would have been delivered, so they
        # consume claim budget like delivered rows. Deleting them out-of-band
        # would leave the budget to spill onto unclaimed due rows — the overlap
        # claimed_count prevents.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        stale = [
            Factories.create_webhook_payload(
                mailbox_name="github:123",
                cell_name="us",
                provider="github",
                date_added=timezone.now() - timedelta(days=4),
            )
            for _ in range(3)
        ]
        fresh = create_payloads(5, "github:123", provider="github")

        # The claim covered the 3 stale rows plus 3 fresh ones.
        drain_mailbox(
            stale[0].id, claimed_count=6, valid_until=fresh_deadline(), mailbox="github:123"
        )

        # The 3 stale rows are discarded without requests and only the 3 claimed
        # fresh rows are delivered; the rest stay for the next claim.
        assert len(responses.calls) == 3
        remaining_ids = set(WebhookPayload.objects.values_list("id", flat=True))
        assert remaining_ids == {fresh[3].id, fresh[4].id}

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 1})
    def test_drain_discards_stale_rows_instead_of_delivering(self) -> None:
        # MAX_DELIVERY_AGE applies to in-order drains too: stale rows are
        # discarded in the walk, not forwarded days late.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        for _ in range(2):
            Factories.create_webhook_payload(
                mailbox_name="github:123",
                cell_name="us",
                provider="github",
                date_added=timezone.now() - timedelta(days=4),
            )
        records = create_payloads(2, "github:123", provider="github")

        head = WebhookPayload.objects.order_by("id").first()
        assert head
        drain_mailbox(head.id, claimed_count=4, valid_until=fresh_deadline(), mailbox="github:123")

        # Only the two fresh rows produce requests; everything is drained.
        assert len(responses.calls) == 2
        assert WebhookPayload.objects.count() == 0
        assert len(records) == 2

    @responses.activate
    @override_cells(cell_config)
    def test_drain_stops_on_failure_for_non_allowlisted_provider(self) -> None:
        url = "http://us.testserver/extensions/jira/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=500, body="")
        records = create_payloads(5, "jira:123", provider="jira")
        drain_mailbox(
            records[0].id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="jira:123",
        )

        # jira is not in the allowlist: processing stops on the first failure
        # to preserve strict mailbox ordering.
        assert len(responses.calls) == 2

        # The failed message and all subsequent messages remain.
        assert WebhookPayload.objects.count() == 4

        first = WebhookPayload.objects.order_by("id").first()
        assert first
        assert first.attempts == 1
        assert first.schedule_for > timezone.now()

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_github_enterprise(self) -> None:
        assert_drain_skips_failed_message("github_enterprise")

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_bitbucket(self) -> None:
        assert_drain_skips_failed_message("bitbucket")

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_bitbucket_server(self) -> None:
        assert_drain_skips_failed_message("bitbucket_server")

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_gitlab(self) -> None:
        assert_drain_skips_failed_message("gitlab")

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 1})
    def test_drain_skip_on_failure_in_order(self) -> None:
        # One worker thread delivers in order; skipping past the failure is a
        # distinct branch there, not a side effect of concurrent delivery.
        assert_drain_skips_failed_message("github")

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.drain_batch_deletes": True})
    def test_drain_batch_deletes_delivered_rows(self) -> None:
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(4, "github:123", provider="github")

        with CaptureQueriesContext(connections["control"]) as ctx:
            drain_mailbox(
                records[0].id, claimed_count=4, valid_until=fresh_deadline(), mailbox="github:123"
            )

        assert len(responses.calls) == 4
        assert WebhookPayload.objects.count() == 0
        # Delivered rows are removed at the slice boundary in one statement
        # instead of one DELETE per delivered webhook.
        delete_queries = [q["sql"] for q in ctx.captured_queries if q["sql"].startswith("DELETE")]
        assert len(delete_queries) == 1

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.drain_batch_deletes": True})
    def test_drain_batch_deletes_flush_when_drain_stops_on_failure(self) -> None:
        url = "http://us.testserver/extensions/jira/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=500, body="")
        records = create_payloads(5, "jira:123", provider="jira")

        drain_mailbox(
            records[0].id, claimed_count=5, valid_until=fresh_deadline(), mailbox="jira:123"
        )

        # jira requires strict ordering: the drain stops at the failure, but the
        # two messages delivered before it must still have their rows removed.
        assert len(responses.calls) == 3
        remaining = set(WebhookPayload.objects.values_list("id", flat=True))
        assert remaining == {records[2].id, records[3].id, records[4].id}

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.drain_batch_deletes": True})
    def test_drain_batch_deletes_discarded_rows(self) -> None:
        # Discards are the other half of a drain's delete traffic, and on a
        # backlogged mailbox the larger half: they must share the batch rather
        # than issue a DELETE per row alongside it.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        stale = Factories.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            provider="github",
            request_path="/extensions/github/webhook/",
            date_added=timezone.now() - timedelta(days=4),
        )
        exhausted = Factories.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            provider="github",
            request_path="/extensions/github/webhook/",
            attempts=MAX_ATTEMPTS,
        )
        create_payloads(2, "github:123", provider="github")

        with CaptureQueriesContext(connections["control"]) as ctx:
            drain_mailbox(
                stale.id, claimed_count=4, valid_until=fresh_deadline(), mailbox="github:123"
            )

        # Only the two fresh rows are delivered; the stale and attempts-exhausted
        # rows are discarded without a request.
        assert len(responses.calls) == 2
        assert not WebhookPayload.objects.filter(id__in=[stale.id, exhausted.id]).exists()
        assert WebhookPayload.objects.count() == 0
        delete_queries = [q["sql"] for q in ctx.captured_queries if q["sql"].startswith("DELETE")]
        assert len(delete_queries) == 1

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.drain_batch_deletes": True})
    @patch.object(deliver_webhooks, "DELETE_BATCH_SIZE", 2)
    def test_drain_batch_deletes_are_bounded(self) -> None:
        # A crash strands whatever has not been flushed, so batches must stay
        # bounded rather than growing for the drain's whole run.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(5, "github:123", provider="github")

        with CaptureQueriesContext(connections["control"]) as ctx:
            drain_mailbox(
                records[0].id, claimed_count=5, valid_until=fresh_deadline(), mailbox="github:123"
            )

        assert WebhookPayload.objects.count() == 0
        # Two full batches during the walk plus the remainder at the end.
        delete_queries = [q["sql"] for q in ctx.captured_queries if q["sql"].startswith("DELETE")]
        assert len(delete_queries) == 3

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.drain_batch_deletes": True})
    def test_drain_batch_deletes_span_concurrent_deliveries(self) -> None:
        # The delete batch belongs to the drain, not to one result: eight
        # concurrent deliveries flush as a single DELETE.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(8, "github:123", provider="github")

        with CaptureQueriesContext(connections["control"]) as ctx:
            drain_mailbox(
                records[0].id, claimed_count=8, valid_until=fresh_deadline(), mailbox="github:123"
            )

        assert len(responses.calls) == 8
        assert WebhookPayload.objects.count() == 0
        delete_queries = [q["sql"] for q in ctx.captured_queries if q["sql"].startswith("DELETE")]
        assert len(delete_queries) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_mailbox_multiple_consecutive_failures(self) -> None:
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=500, body="")
        records = create_payloads(5, "github:123", provider="github")
        drain_mailbox(
            records[0].id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        # All 5 messages are attempted even though all fail.
        assert len(responses.calls) == 5

        # All 5 messages remain with incremented attempts and a future schedule_for.
        assert WebhookPayload.objects.count() == 5
        for record in WebhookPayload.objects.all():
            assert record.attempts == 1
            assert record.schedule_for > timezone.now()

    @responses.activate
    @override_cells(cell_config)
    def test_drain_success(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        records = create_payloads(3, "github:123")
        drain_mailbox(
            records[0].id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        # Mailbox should be empty
        assert not WebhookPayload.objects.filter().exists()

    @responses.activate
    @override_cells(cell_config)
    def test_drain_too_many_attempts(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            attempts=MAX_ATTEMPTS,
        )
        drain_mailbox(
            webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 0

    @responses.activate
    @override_cells(cell_config)
    def test_drain_more_than_max_attempts(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            attempts=MAX_ATTEMPTS + 1,
        )
        drain_mailbox(
            webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 0

    @responses.activate
    @override_cells(cell_config)
    def test_drain_fatality(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            # While this specific scenario won't happen, the client libraries could fail
            body=ValueError(),
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        with pytest.raises(ValueError):
            drain_mailbox(
                webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
            )
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert hook.attempts == 1
        assert hook.schedule_for >= timezone.now()
        assert len(responses.calls) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_host_error(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            body=ConnectionError(),
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        drain_mailbox(
            webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert len(responses.calls) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_conflict(self) -> None:
        # Getting a conflict back from the cell silo means
        # we should drop the hook.
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=409,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        drain_mailbox(
            webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_api_error_unauthorized(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=401,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        drain_mailbox(
            webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        # We don't retry 401
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_api_error_bad_request(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=400,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        drain_mailbox(
            webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        # We don't retry 400
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_api_error_forbidden(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=403,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        drain_mailbox(
            webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        # We don't retry 403
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_not_found(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/plugins/github/organizations/123/webhook/",
            status=404,
            body="<html><title>lol nope</title></html>",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="plugins:123",
            cell_name="us",
            request_path="/plugins/github/organizations/123/webhook/",
        )
        drain_mailbox(
            webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="plugins:123"
        )

        # We don't retry if the region 404s
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_timeout(self) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", body=ReadTimeout()
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        drain_mailbox(
            webhook_one.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert hook.schedule_for > timezone.now()
        assert hook.attempts == 1

        assert len(responses.calls) == 1

    @responses.activate
    @override_cells(cell_config_with_gateway)
    def test_drain_success_api_gateway_address(self) -> None:
        responses.add(
            responses.POST,
            "http://sentry-rpc-gateway/extensions/github/webhook/",
            status=200,
            body="",
        )
        records = create_payloads(3, "github:123")
        drain_mailbox(
            records[0].id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        # Mailbox should be empty
        assert not WebhookPayload.objects.filter().exists()


@control_silo_test
class SlowDeliveryLoggingTest(TestCase):
    @responses.activate
    @override_cells(cell_config)
    def test_slow_delivery_logged(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            provider="github",
            request_body='{"repository": {"owner": {"login": "getsentry"}}}',
        )
        # date_added is 11 minutes ago (10 min threshold + 1 min)
        WebhookPayload.objects.filter(id=webhook.id).update(
            date_added=timezone.now() - SLOW_DELIVERY_THRESHOLD - timedelta(minutes=1)
        )
        # Update in-memory webhook object with the updated date_added
        webhook.refresh_from_db()
        expected_date_added = webhook.date_added.isoformat()

        with self.assertLogs("sentry.hybridcloud.tasks.deliver_webhooks", level="WARNING") as cm:
            drain_mailbox(
                webhook.id,
                claimed_count=MAX_MAILBOX_DRAIN,
                valid_until=fresh_deadline(),
                mailbox="github:123",
            )

        slow_log = next(r for r in cm.records if "deliver_webhook.slow_delivery" in r.msg)
        # extra dict from logger becomes attributes on LogRecord at runtime
        log_extra: Any = slow_log
        assert log_extra.id == webhook.id
        assert log_extra.mailbox_name == "github:123"
        assert log_extra.provider == "github"
        assert log_extra.cell_name == "us"
        # date_added is logged as ISO string; attempts reflects the count before the successful attempt
        assert log_extra.date_added == expected_date_added
        assert log_extra.attempts == 0


@control_silo_test
class DeliveryTimeMetricsTest(MetricCallsMixin, TestCase):
    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_delivery_time_metrics_cell_sent_to(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )
        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        delivery_time_tags = self.distribution_tags(mock_metrics, DELIVERY_TIME_METRIC)
        assert len(delivery_time_tags) == 1
        tags = delivery_time_tags[0]
        assert tags.get("region_sent_to") == "us"
        assert tags.get("provider") == "github"
        # An event-typed provider whose mailbox carries no event suffix.
        assert tags.get("event_type") == "unknown"
        # A drain with no dispatcher still emits the attribution key; a tag
        # missing from some series breaks grouping rather than showing a gap.
        assert tags.get("dispatcher") == "unknown"

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_delivery_time_metrics_github_event_type(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123:0:pull_request",
            cell_name="us",
            provider="github",
        )
        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123:0:pull_request",
        )

        delivery_time_tags = self.distribution_tags(mock_metrics, DELIVERY_TIME_METRIC)
        assert len(delivery_time_tags) == 1
        tags = delivery_time_tags[0]
        assert tags.get("region_sent_to") == "us"
        assert tags.get("provider") == "github"
        assert tags.get("event_type") == "pull_request"

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_delivery_time_metrics_non_github_event_type(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="stripe:123",
            cell_name="us",
            provider="stripe",
        )
        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="stripe:123",
        )

        delivery_time_tags = self.distribution_tags(mock_metrics, DELIVERY_TIME_METRIC)
        assert len(delivery_time_tags) == 1
        tags = delivery_time_tags[0]
        assert tags.get("region_sent_to") == "us"
        assert tags.get("provider") == "stripe"
        assert tags.get("event_type") == "none"

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_delivery_time_metrics_github_mailbox_without_event_suffix(
        self, mock_metrics: MagicMock
    ) -> None:
        """A delivery with no X-GitHub-Event header mailboxes without the suffix."""
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            provider="github",
        )
        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        delivery_time_tags = self.distribution_tags(mock_metrics, DELIVERY_TIME_METRIC)
        assert len(delivery_time_tags) == 1
        tags = delivery_time_tags[0]
        assert tags.get("provider") == "github"
        assert tags.get("event_type") == "unknown"


@control_silo_test
class DroppedDeliveryOutcomeTest(MetricCallsMixin, TestCase):
    """
    A payload the cell permanently rejects is deleted just like a delivered one, so
    it must not be reported as a delivery.
    """

    def delivery_outcomes(self, mock_metrics: MagicMock) -> list[str]:
        return [tags["outcome"] for tags in self.tags_for(mock_metrics, DELIVERY_METRIC)]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_drain_conflict_not_counted_as_delivered(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=409,
            body="",
        )
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        assert not WebhookPayload.objects.filter(id=webhook.id).exists()
        assert self.delivery_outcomes(mock_metrics) == ["conflict"]
        assert self.distribution_calls(mock_metrics, DELIVERY_TIME_METRIC) == []

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_drain_unauthorized_not_counted_as_delivered(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=401,
            body="",
        )
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        assert not WebhookPayload.objects.filter(id=webhook.id).exists()
        assert self.delivery_outcomes(mock_metrics) == ["dropped_4xx"]
        assert self.distribution_calls(mock_metrics, DELIVERY_TIME_METRIC) == []

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_drain_success_still_counted_as_delivered(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        assert self.delivery_outcomes(mock_metrics) == ["ok"]
        assert len(self.distribution_calls(mock_metrics, DELIVERY_TIME_METRIC)) == 1

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 1})
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_in_order_conflict_not_counted_as_delivered(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=409,
            body="",
        )
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        drain_mailbox(
            webhook.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )

        assert not WebhookPayload.objects.filter(id=webhook.id).exists()
        assert self.delivery_outcomes(mock_metrics) == ["conflict"]
        assert self.distribution_calls(mock_metrics, DELIVERY_TIME_METRIC) == []

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 1})
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_in_order_unauthorized_not_counted_as_delivered(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=401,
            body="",
        )
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        drain_mailbox(
            webhook.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )

        assert not WebhookPayload.objects.filter(id=webhook.id).exists()
        assert self.delivery_outcomes(mock_metrics) == ["dropped_4xx"]
        assert self.distribution_calls(mock_metrics, DELIVERY_TIME_METRIC) == []

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_dropped_payload_does_not_stall_ordered_mailbox(self, mock_metrics: MagicMock) -> None:
        # A drop is terminal, not a retryable failure, so the drain must continue
        # past it even for providers that stop on the first failure.
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/jira/webhook/",
            status=401,
            body="",
        )
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/jira/webhook/",
            status=200,
            body="",
        )
        first, second = create_payloads(2, "jira:123", provider="jira")

        drain_mailbox(
            first.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="jira:123",
        )

        assert not WebhookPayload.objects.filter(id=second.id).exists()
        assert self.delivery_outcomes(mock_metrics) == ["dropped_4xx", "ok"]


@control_silo_test
class ProviderMetricTagTest(MetricCallsMixin, TestCase):
    """
    The `$provider` dashboard selector filters on this tag, so a delivery metric
    emitted without it silently disappears when a provider is selected.
    """

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_delivery_tagged_with_provider(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123", cell_name="us", provider="github"
        )

        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {**UNATTRIBUTED, "outcome": "ok", "provider": "github"}
        ]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_failure_tagged_with_provider(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=401,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123", cell_name="us", provider="github"
        )

        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        assert self.tags_for(mock_metrics, "hybridcloud.deliver_webhooks.failure") == [
            {"reason": "unauthorized", "destination_region": "us", "provider": "github"}
        ]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_dropped_outcomes_tagged_with_provider(self, mock_metrics: MagicMock) -> None:
        # `conflict` and `dropped_4xx` are delivery outcomes like any other, so they
        # must carry the tag too or they vanish when a provider is selected.
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=409,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123", cell_name="us", provider="github"
        )

        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {**UNATTRIBUTED, "outcome": "conflict", "provider": "github"}
        ]

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 1})
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_in_order_dropped_outcome_tagged_with_provider(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=401,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123", cell_name="us", provider="github"
        )

        drain_mailbox(
            webhook.id, claimed_count=1, valid_until=fresh_deadline(), mailbox="github:123"
        )

        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {**UNATTRIBUTED, "outcome": "dropped_4xx", "provider": "github"}
        ]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_provider_comes_from_the_mailbox_not_the_row(self, mock_metrics: MagicMock) -> None:
        # The mailbox is what the dispatcher decided by, so it is what the outcome
        # is tagged with — a row disagreeing with its own mailbox cannot split it.
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        webhook.update(provider=None)

        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {**UNATTRIBUTED, "outcome": "ok", "provider": "github"}
        ]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_provider_falls_back_to_unknown(self, mock_metrics: MagicMock) -> None:
        # A mailbox name with no provider segment has nothing to name it with.
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", status=200, body=""
        )
        webhook = self.create_webhook_payload(mailbox_name="legacy", cell_name="us")

        drain_mailbox(
            webhook.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="legacy",
        )

        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {**UNATTRIBUTED, "outcome": "ok", "provider": "unknown"}
        ]

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_provider_from_mailbox_name(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        # No payload row is loaded on this path, so the provider comes from the name.
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        maybe_trigger_drain(webhook.mailbox_name)

        assert self.tags_for(mock_metrics, "hybridcloud.deliver_webhooks.push_trigger.success") == [
            {"provider": "github"}
        ]


@control_silo_test
class DispatchMetricTest(MetricCallsMixin, TestCase):
    """
    One test per dispatch path: a path that stops emitting silently attributes its
    work to the other dispatcher.
    """

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_dispatch_attributed_to_push(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        maybe_trigger_drain(webhook.mailbox_name)

        assert mock_drain.delay.call_args.kwargs["dispatcher"] == Dispatcher.PUSH
        assert self.tags_for(mock_metrics, DISPATCH_METRIC) == [
            {"dispatcher": "push", "provider": "github"}
        ]
        assert self.distribution_calls(mock_metrics, DISPATCH_CLAIMED_METRIC) == [
            (1, {"dispatcher": "push", "provider": "github"})
        ]

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_scheduler_dispatch_reports_batch_depth(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        # Deep on purpose: `claimed` must report the batch, not one per dispatch,
        # or webhook share collapses back into dispatch share.
        depth = 3
        for _ in range(depth):
            self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        schedule_webhook_delivery()

        assert mock_drain.delay.call_args.kwargs["dispatcher"] == Dispatcher.SCHEDULER
        assert self.tags_for(mock_metrics, DISPATCH_METRIC) == [
            {"dispatcher": "scheduler", "provider": "github"}
        ]
        assert self.distribution_calls(mock_metrics, DISPATCH_CLAIMED_METRIC) == [
            (depth, {"dispatcher": "scheduler", "provider": "github"})
        ]


@control_silo_test
class DeliveryDispatchTagTest(MetricCallsMixin, TestCase):
    """
    Delivery outcomes carry the attribution of the drain that produced them, so
    push- and scheduler-dispatched work stay separable rather than collapsing
    into one global total.
    """

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_delivery_carries_dispatch_attribution(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123", cell_name="us", provider="github"
        )

        drain_mailbox(
            webhook.id,
            claimed_count=1,
            dispatcher=Dispatcher.SCHEDULER,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {"dispatcher": "scheduler", "outcome": "ok", "provider": "github"}
        ]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_delivery_time_carries_dispatch_attribution(self, mock_metrics: MagicMock) -> None:
        # Latency is what dispatch is meant to move, so it needs the same
        # attribution as the counter to be comparable between dispatchers.
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123", cell_name="us", provider="github"
        )

        drain_mailbox(
            webhook.id,
            claimed_count=1,
            dispatcher=Dispatcher.SCHEDULER,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        assert self.distribution_tags(mock_metrics, DELIVERY_TIME_METRIC) == [
            {
                "dispatcher": "scheduler",
                "region_sent_to": "us",
                "provider": "github",
                # This fixture's mailbox carries no event-type suffix to read.
                "event_type": "unknown",
            }
        ]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_concurrent_delivery_time_carries_dispatch_attribution(
        self, mock_metrics: MagicMock
    ) -> None:
        # Attribution must survive the threadpool hop, not only the in-order walk.
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        records = create_payloads(2, "github:123", provider="github")

        drain_mailbox(
            records[0].id,
            claimed_count=2,
            dispatcher=Dispatcher.PUSH,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        expected = {
            "dispatcher": "push",
            "region_sent_to": "us",
            "provider": "github",
            "event_type": "unknown",
        }
        assert self.distribution_tags(mock_metrics, DELIVERY_TIME_METRIC) == [expected, expected]

    @responses.activate
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_race_outcome_carries_dispatch_attribution(self, mock_metrics: MagicMock) -> None:
        records = create_payloads(2, "github:123", provider="github")
        head_id = records[0].id
        records[0].delete()

        drain_mailbox(
            head_id,
            claimed_count=2,
            dispatcher=Dispatcher.PUSH,
            mailbox="github:123",
            valid_until=fresh_deadline(),
        )

        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {"dispatcher": "push", "outcome": "race", "provider": "github"}
        ]


@control_silo_test
class LostHeadTest(MetricCallsMixin, TestCase):
    """
    A drain whose head row is gone was overtaken: whoever claimed the mailbox next
    has been delivering it, so anything still there belongs to that drain.
    """

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 1})
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_drain_delivers_nothing_when_its_head_is_gone(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", status=200, body=""
        )
        records = create_payloads(3, "github:123", provider="github")
        head_id = records[0].id
        records[0].delete()

        drain_mailbox(head_id, claimed_count=3, mailbox="github:123", valid_until=fresh_deadline())

        assert len(responses.calls) == 0
        assert WebhookPayload.objects.count() == 2
        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {**UNATTRIBUTED, "outcome": "race", "provider": "github"}
        ]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_concurrent_drain_delivers_nothing_when_its_head_is_gone(
        self, mock_metrics: MagicMock
    ) -> None:
        # The stand-down must come before the first request is sent, not after
        # it: these rows are the overtaking drain's to deliver, and sending them
        # here duplicates every one of them.
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", status=200, body=""
        )
        records = create_payloads(3, "github:123", provider="github")
        head_id = records[0].id
        records[0].delete()

        drain_mailbox(head_id, claimed_count=3, mailbox="github:123", valid_until=fresh_deadline())

        assert len(responses.calls) == 0
        assert WebhookPayload.objects.count() == 2
        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {**UNATTRIBUTED, "outcome": "race", "provider": "github"}
        ]


@control_silo_test
class StaleClaimTest(MetricCallsMixin, TestCase):
    """
    A drain that waited past its claim's deadline must stand down: its rows have
    fallen due for another dispatcher, so delivering them again duplicates.
    """

    def expired(self) -> float:
        """A claim deadline that has already passed."""
        return (timezone.now() - timedelta(seconds=1)).timestamp()

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_expired_claim_leaves_rows_alone(self, mock_metrics: MagicMock) -> None:
        records = create_payloads(2, "github:123", provider="github")

        drain_mailbox(
            records[0].id, claimed_count=2, valid_until=self.expired(), mailbox="github:123"
        )

        assert len(responses.calls) == 0
        # Untouched, not merely undelivered: the owning drain is mid-flight here.
        assert WebhookPayload.objects.count() == 2
        for record in records:
            schedule_for = record.schedule_for
            record.refresh_from_db()
            assert record.attempts == 0
            assert record.schedule_for == schedule_for
        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {**UNATTRIBUTED, "outcome": "delivery_deadline", "provider": "github"}
        ]

    @responses.activate
    @override_cells(cell_config)
    def test_drain_stops_at_the_claim_deadline_not_a_fresh_one(self) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", status=200, body=""
        )
        records = create_payloads(1, "github:123", provider="github")

        # A zero offset makes a freshly computed horizon expire immediately, so a
        # delivery here can only come from the claim's own deadline. A drain that
        # waited in the queue must run on the claim's remainder, not a new horizon.
        with patch.object(deliver_webhooks, "BATCH_SCHEDULE_OFFSET", timedelta(minutes=0)):
            drain_mailbox(
                records[0].id,
                claimed_count=1,
                valid_until=(timezone.now() + timedelta(minutes=5)).timestamp(),
                mailbox="github:123",
            )

        assert len(responses.calls) == 1
        assert WebhookPayload.objects.count() == 0

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_dispatch_passes_the_rows_own_deadline(self, mock_drain: MagicMock) -> None:
        # The drain must be handed the schedule_for its claim wrote, not a value
        # recomputed from an offset that may differ between dispatcher and worker.
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        schedule_webhook_delivery()

        valid_until = datetime.fromtimestamp(
            mock_drain.delay.call_args.kwargs["valid_until"], tz=UTC
        )
        webhook.refresh_from_db()
        assert webhook.schedule_for == valid_until

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_fresh_claim_delivers(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", status=200, body=""
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123", cell_name="us", provider="github"
        )

        valid_until = (timezone.now() + BATCH_SCHEDULE_OFFSET).timestamp()
        drain_mailbox(webhook.id, claimed_count=1, valid_until=valid_until, mailbox="github:123")

        assert len(responses.calls) == 1
        assert WebhookPayload.objects.count() == 0

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_claim_is_stale_at_its_deadline_exactly(self, mock_metrics: MagicMock) -> None:
        # The due gates are schedule_for__lte=now, so at the deadline exactly the
        # rows already belong to other dispatchers.
        webhook = self.create_webhook_payload(
            mailbox_name="github:123", cell_name="us", provider="github"
        )
        deadline = timezone.now()

        with patch("sentry.hybridcloud.tasks.deliver_webhooks.timezone.now", return_value=deadline):
            drain_mailbox(
                webhook.id,
                claimed_count=1,
                valid_until=deadline.timestamp(),
                mailbox="github:123",
            )

        assert len(responses.calls) == 0
        assert WebhookPayload.objects.count() == 1
        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {**UNATTRIBUTED, "outcome": "delivery_deadline", "provider": "github"}
        ]

    @responses.activate
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_expired_claim_on_deleted_head_still_names_the_provider(
        self, mock_metrics: MagicMock
    ) -> None:
        # The head may already be delivered; the stand-down still reports, and the
        # mailbox names the provider with no row left to read.
        drain_mailbox(
            99,
            claimed_count=1,
            dispatcher=Dispatcher.PUSH,
            valid_until=self.expired(),
            mailbox="github:123",
        )

        assert self.tags_for(mock_metrics, DELIVERY_METRIC) == [
            {"dispatcher": "push", "outcome": "delivery_deadline", "provider": "github"}
        ]

    @override_cells(cell_config)
    def test_strict_provider_never_delivers_concurrently(self) -> None:
        # Depth never buys a strict-ordering provider a second thread: the next
        # request must not start until the previous one has completed.
        records = create_payloads(7, "jira:123", provider="jira")
        peak = ConcurrencyProbe()

        with patch.object(deliver_webhooks, "deliver_message", side_effect=peak.deliver):
            drain_mailbox(
                records[0].id,
                claimed_count=len(records),
                valid_until=fresh_deadline(),
                mailbox="jira:123",
            )

        assert peak.value == 1
        assert WebhookPayload.objects.count() == 0

    @override_cells(cell_config)
    def test_skip_on_failure_provider_delivers_concurrently(self) -> None:
        records = create_payloads(7, "github:123", provider="github")
        peak = ConcurrencyProbe()

        with patch.object(deliver_webhooks, "deliver_message", side_effect=peak.deliver):
            drain_mailbox(
                records[0].id,
                claimed_count=len(records),
                valid_until=fresh_deadline(),
                mailbox="github:123",
            )

        assert peak.value > 1
        assert WebhookPayload.objects.count() == 0


@control_silo_test
class DeadlineReleaseTest(MetricCallsMixin, TestCase):
    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_release_makes_unworked_tail_claimable_now(self, mock_metrics: MagicMock) -> None:
        valid_until = timezone.now() + RELEASE_MARGIN / 2
        records = create_payloads(3, "github:123", provider="github")
        WebhookPayload.objects.filter(id__in=[r.id for r in records]).update(
            schedule_for=valid_until
        )

        drain_mailbox(
            records[0].id,
            claimed_count=3,
            valid_until=valid_until.timestamp(),
            mailbox="github:123",
        )

        assert len(responses.calls) == 0
        for record in records:
            record.refresh_from_db()
            assert record.schedule_for <= timezone.now()
        released = [
            call
            for call in mock_metrics.incr.call_args_list
            if call[0][0] == DELIVERY_METRIC and call[1]["tags"].get("outcome") == "released"
        ]
        assert len(released) == 1
        assert released[0][1]["amount"] == 3

    @responses.activate
    @override_cells(cell_config)
    def test_release_skips_rows_the_claim_no_longer_owns(self) -> None:
        valid_until = timezone.now() + RELEASE_MARGIN / 2
        records = create_payloads(3, "github:123", provider="github")
        WebhookPayload.objects.filter(id__in=[r.id for r in records]).update(
            schedule_for=valid_until
        )
        # A row rescheduled into a retry backoff, or taken by another claim,
        # carries a different schedule_for and must keep it.
        backoff = timezone.now() + timedelta(minutes=10)
        records[1].update(schedule_for=backoff)

        drain_mailbox(
            records[0].id,
            claimed_count=3,
            valid_until=valid_until.timestamp(),
            mailbox="github:123",
        )

        records[1].refresh_from_db()
        assert records[1].schedule_for == backoff
        for record in (records[0], records[2]):
            record.refresh_from_db()
            assert record.schedule_for <= timezone.now()

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 1})
    def test_release_covers_only_the_tail_behind_delivered_rows(self) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", status=200, body=""
        )
        valid_until = timezone.now() + BATCH_SCHEDULE_OFFSET
        records = create_payloads(3, "github:123", provider="github")
        WebhookPayload.objects.filter(id__in=[r.id for r in records]).update(
            schedule_for=valid_until
        )

        # Deadline nears after the first delivery: the drain must release only
        # what it never reached.
        with patch.object(
            deliver_webhooks._MailboxClaim,
            "nearing_deadline",
            side_effect=[False, True],
        ):
            drain_mailbox(
                records[0].id,
                claimed_count=3,
                valid_until=valid_until.timestamp(),
                mailbox="github:123",
            )

        assert len(responses.calls) == 1
        assert not WebhookPayload.objects.filter(id=records[0].id).exists()
        for record in (records[1], records[2]):
            record.refresh_from_db()
            assert record.schedule_for <= timezone.now()

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 2})
    def test_release_settles_in_flight_requests_before_covering_the_tail(self) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", status=200, body=""
        )
        valid_until = timezone.now() + BATCH_SCHEDULE_OFFSET
        records = create_payloads(4, "github:123", provider="github")
        WebhookPayload.objects.filter(id__in=[r.id for r in records]).update(
            schedule_for=valid_until
        )

        # The deadline nears once the first two requests are in flight: both must
        # settle — delivered and deleted — before the tail behind them is released.
        with patch.object(
            deliver_webhooks._MailboxClaim,
            "nearing_deadline",
            side_effect=[False, True],
        ):
            drain_mailbox(
                records[0].id,
                claimed_count=4,
                valid_until=valid_until.timestamp(),
                mailbox="github:123",
            )

        assert len(responses.calls) == 2
        assert not WebhookPayload.objects.filter(id__in=[records[0].id, records[1].id]).exists()
        for record in (records[2], records[3]):
            record.refresh_from_db()
            assert record.schedule_for <= timezone.now()

    @override_cells(cell_config)
    def test_wind_down_cancels_unstarted_requests_and_names_the_release_start(self) -> None:
        # Two threads, three requests: the third waits in the executor's queue and
        # is cancelled, so the release must start at it — not at the frontier
        # past it, which would leave it stranded until the claim's deadline.
        records = create_payloads(3, "github:123", provider="github")

        def deliver(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
            time.sleep(0.2)
            return (payload, None)

        with patch.object(deliver_webhooks, "deliver_message", side_effect=deliver):
            pool = deliver_webhooks._DeliveryPool(
                deliver_webhooks._PayloadDeleter(batched=False),
                worker_threads=2,
                delivery_tags={**UNATTRIBUTED, "provider": "github"},
                valid_until=timezone.now() + BATCH_SCHEDULE_OFFSET,
                spends_attempt_on_submit=False,
            )
            for record in records:
                pool.submit(record)
            lowest_cancelled = pool.wind_down(reason="deadline")

        assert lowest_cancelled == records[2].id
        assert pool.delivered == 2
        assert set(WebhookPayload.objects.values_list("id", flat=True)) == {records[2].id}

    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_wind_down_records_how_long_it_waited(self, mock_metrics: MagicMock) -> None:
        # REQUEST_BOUND caps this wait, so every wind-down that had something
        # to wait for reports its length under the reason it stopped — and one
        # with nothing in flight reports nothing, or the no-op wind-down in
        # every drain's `finally` would bury the real ones.
        record = create_payloads(1, "github:123", provider="github")[0]
        tags = {**UNATTRIBUTED, "provider": "github"}

        def deliver(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
            time.sleep(0.1)
            return (payload, None)

        with patch.object(deliver_webhooks, "deliver_message", side_effect=deliver):
            pool = deliver_webhooks._DeliveryPool(
                deliver_webhooks._PayloadDeleter(batched=False),
                worker_threads=1,
                delivery_tags=tags,
                valid_until=timezone.now() + BATCH_SCHEDULE_OFFSET,
                spends_attempt_on_submit=False,
            )
            pool.submit(record)
            pool.wind_down(reason="deadline")
            pool.wind_down(reason="cleanup")

        waits = self.distribution_calls(
            mock_metrics, "hybridcloud.deliver_webhooks.drain.wind_down_ms"
        )
        assert [tags_ for _, tags_ in waits] == [{**tags, "reason": "deadline"}]
        assert waits[0][0] >= 100

    @override_cells(cell_config)
    @patch.object(deliver_webhooks, "REQUEST_BOUND", timedelta(seconds=0.3))
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_wind_down_abandons_a_request_it_cannot_wait_out(self, mock_metrics: MagicMock) -> None:
        # The request bound caps the wait: a request still running at it is
        # given up on — rescheduled into its backoff, its row kept — while the
        # sibling that answered is deleted, and the call returns without joining
        # the stuck thread.
        stuck, answered = create_payloads(2, "github:123", provider="github")
        release = threading.Event()
        self.addCleanup(release.set)
        stuck_started = threading.Event()
        answered_returned = threading.Event()

        def deliver(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
            if payload.id == stuck.id:
                stuck_started.set()
                release.wait()
            else:
                answered_returned.set()
            return (payload, None)

        with patch.object(deliver_webhooks, "deliver_message", side_effect=deliver):
            pool = deliver_webhooks._DeliveryPool(
                deliver_webhooks._PayloadDeleter(batched=False),
                worker_threads=2,
                delivery_tags={**UNATTRIBUTED, "provider": "github"},
                valid_until=timezone.now() + BATCH_SCHEDULE_OFFSET,
                spends_attempt_on_submit=False,
            )
            pool.submit(stuck)
            pool.submit(answered)
            # Not yet started means cancellable, which is a different outcome.
            assert stuck_started.wait(timeout=5)
            assert answered_returned.wait(timeout=5)
            pool.wind_down(reason="deadline")

        assert pool.delivered == 1
        assert pool.failed == 1
        assert not WebhookPayload.objects.filter(id=answered.id).exists()
        stuck.refresh_from_db()
        assert stuck.attempts == 1
        assert stuck.schedule_for > timezone.now()
        assert self.tags_for(mock_metrics, DELIVERY_METRIC)[-1] == {
            **UNATTRIBUTED,
            "provider": "github",
            "outcome": "abandoned",
        }

    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.worker_threads": 2})
    @patch.object(deliver_webhooks, "REQUEST_BOUND", timedelta(seconds=1))
    def test_unresponsive_cell_stops_the_drain_without_releasing(self) -> None:
        # Nothing answering inside the request bound means the cell is down: the
        # in-flight records go into their backoff and the drain stops. The tail
        # stays under the claim rather than being released — a release would
        # only send the next drain straight into the same cell.
        records = create_payloads(4, "github:123", provider="github")
        valid_until = timezone.now() + BATCH_SCHEDULE_OFFSET
        WebhookPayload.objects.filter(id__in=[r.id for r in records]).update(
            schedule_for=valid_until
        )
        release = threading.Event()
        self.addCleanup(release.set)

        def deliver(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
            release.wait()
            return (payload, None)

        with patch.object(deliver_webhooks, "deliver_message", side_effect=deliver):
            drain_mailbox(
                records[0].id,
                claimed_count=4,
                valid_until=valid_until.timestamp(),
                mailbox="github:123",
            )

        for record in records[:2]:
            record.refresh_from_db()
            assert record.attempts == 1
            assert record.schedule_for > valid_until
        for record in records[2:]:
            record.refresh_from_db()
            assert record.attempts == 0
            assert record.schedule_for == valid_until

    @override_cells(cell_config)
    def test_wind_down_handles_a_request_that_lands_during_the_settle(self) -> None:
        # Handling the results that were in takes real time (deletes); a request
        # that returns meanwhile has a result, and abandoning it would redeliver
        # a webhook the cell already took.
        early, late = create_payloads(2, "github:123", provider="github")
        late_started = threading.Event()
        late_may_return = threading.Event()

        def deliver(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
            if payload.id == late.id:
                late_started.set()
                late_may_return.wait()
            return (payload, None)

        def delete_then_release_late(payload: WebhookPayload) -> None:
            payload.delete()
            late_may_return.set()
            time.sleep(0.1)

        with patch.object(deliver_webhooks, "deliver_message", side_effect=deliver):
            pool = deliver_webhooks._DeliveryPool(
                deliver_webhooks._PayloadDeleter(batched=False),
                worker_threads=2,
                delivery_tags={**UNATTRIBUTED, "provider": "github"},
                valid_until=timezone.now() + BATCH_SCHEDULE_OFFSET,
                spends_attempt_on_submit=False,
            )
            pool.submit(early)
            pool.submit(late)
            # Not yet started means cancellable, which is a different outcome.
            assert late_started.wait(timeout=5)
            with patch.object(
                deliver_webhooks._PayloadDeleter, "delete", side_effect=delete_then_release_late
            ):
                pool.wind_down(reason="deadline", patience=0.5)

        assert pool.unexpected is None, repr(pool.unexpected)
        assert pool.delivered == 2
        assert pool.failed == 0
        assert WebhookPayload.objects.count() == 0

    def test_release_margin_covers_the_wait_and_the_settle(self) -> None:
        # The soft-stop must leave room for a full request bound plus the flush
        # and release, or a drain stopping on time still overshoots its claim.
        assert RELEASE_MARGIN == deliver_webhooks.REQUEST_BOUND + SETTLE_ALLOWANCE
        assert (
            deliver_webhooks.REQUEST_BOUND.total_seconds()
            > 2 * deliver_webhooks.CELL_REQUEST_TIMEOUT
        )

    def test_first_backoff_outlasts_the_claim(self) -> None:
        # An abandoned record's request is still running. Its backoff must move
        # its schedule_for off the claim's, or the release hands it straight to
        # the next dispatcher while that request is in flight.
        first_backoff = timedelta(minutes=BACKOFF_INTERVAL * BACKOFF_RATE)
        assert first_backoff > BATCH_SCHEDULE_OFFSET


@control_silo_test
class ChainDispatchTest(TestCase):
    """
    A strict provider's drain that ends healthy with due work behind it
    dispatches the mailbox's next claim itself, while its lineage is within
    max_chain_depth links.
    """

    def _respond_ok(self, provider: str = "jira") -> None:
        responses.add(
            responses.POST,
            f"http://us.testserver/extensions/{provider}/webhook/",
            status=200,
            body="",
        )

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.max_chain_depth": 3})
    @patch.object(deliver_webhooks, "MAX_MAILBOX_DRAIN", 3)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_chains_after_draining_a_full_claim(self, mock_drain: MagicMock) -> None:
        self._respond_ok()
        records = create_payloads(4, "jira:123", provider="jira")

        drain_mailbox(
            records[0].id, claimed_count=3, valid_until=fresh_deadline(), mailbox="jira:123"
        )

        assert len(responses.calls) == 3
        kwargs = mock_drain.delay.call_args.kwargs
        assert kwargs["payload_id"] == records[3].id
        assert kwargs["dispatcher"] == Dispatcher.CHAIN
        assert kwargs["chain_depth"] == 2

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.max_chain_depth": 3})
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_release_chains_the_tail(self, mock_drain: MagicMock) -> None:
        self._respond_ok()
        valid_until = timezone.now() + BATCH_SCHEDULE_OFFSET
        records = create_payloads(3, "jira:123", provider="jira")
        WebhookPayload.objects.filter(id__in=[r.id for r in records]).update(
            schedule_for=valid_until
        )

        with patch.object(
            deliver_webhooks._MailboxClaim, "nearing_deadline", side_effect=[False, True]
        ):
            drain_mailbox(
                records[0].id,
                claimed_count=3,
                valid_until=valid_until.timestamp(),
                mailbox="jira:123",
            )

        # One delivered, two released — the chain claims the released tail.
        assert len(responses.calls) == 1
        kwargs = mock_drain.delay.call_args.kwargs
        assert kwargs["payload_id"] == records[1].id
        assert kwargs["dispatcher"] == Dispatcher.CHAIN

    @responses.activate
    @override_cells(cell_config)
    @patch.object(deliver_webhooks, "MAX_MAILBOX_DRAIN", 3)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_no_chain_at_the_default_depth(self, mock_drain: MagicMock) -> None:
        # The ordinary dispatch is the first link, so the default of 1 means a
        # finished drain never chains.
        self._respond_ok()
        records = create_payloads(4, "jira:123", provider="jira")

        drain_mailbox(
            records[0].id, claimed_count=3, valid_until=fresh_deadline(), mailbox="jira:123"
        )

        assert len(responses.calls) == 3
        mock_drain.delay.assert_not_called()

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.max_chain_depth": 3})
    @patch.object(deliver_webhooks, "MAX_MAILBOX_DRAIN", 3)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_no_chain_past_the_depth_ceiling(self, mock_drain: MagicMock) -> None:
        self._respond_ok()
        records = create_payloads(4, "jira:123", provider="jira")

        drain_mailbox(
            records[0].id,
            claimed_count=3,
            valid_until=fresh_deadline(),
            mailbox="jira:123",
            chain_depth=3,
        )

        mock_drain.delay.assert_not_called()

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.max_chain_depth": 3})
    @patch.object(deliver_webhooks, "MAX_MAILBOX_DRAIN", 3)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_no_chain_for_skip_on_failure_provider(self, mock_drain: MagicMock) -> None:
        # Due-head providers would fork a new pipeline every scheduler cycle.
        self._respond_ok("github")
        records = create_payloads(4, "github:123", provider="github")

        drain_mailbox(
            records[0].id, claimed_count=3, valid_until=fresh_deadline(), mailbox="github:123"
        )

        assert len(responses.calls) == 3
        mock_drain.delay.assert_not_called()

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.max_chain_depth": 3})
    @patch.object(deliver_webhooks, "MAX_MAILBOX_DRAIN", 3)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_no_chain_after_a_failure_stop(self, mock_drain: MagicMock) -> None:
        url = "http://us.testserver/extensions/jira/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=500, body="")
        records = create_payloads(4, "jira:123", provider="jira")

        drain_mailbox(
            records[0].id, claimed_count=3, valid_until=fresh_deadline(), mailbox="jira:123"
        )

        assert len(responses.calls) == 2
        mock_drain.delay.assert_not_called()

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.max_chain_depth": 3})
    @patch.object(deliver_webhooks, "MAX_MAILBOX_DRAIN", 3)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_no_chain_on_a_short_claim(self, mock_drain: MagicMock) -> None:
        # A claim under the cap means the due prefix ended; nothing to chain to.
        self._respond_ok()
        records = create_payloads(2, "jira:123", provider="jira")

        drain_mailbox(
            records[0].id, claimed_count=2, valid_until=fresh_deadline(), mailbox="jira:123"
        )

        assert len(responses.calls) == 2
        mock_drain.delay.assert_not_called()

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.max_chain_depth": 3})
    @patch.object(deliver_webhooks, "MAX_MAILBOX_DRAIN", 3)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_no_chain_while_another_dispatcher_holds_the_lock(self, mock_drain: MagicMock) -> None:
        self._respond_ok()
        records = create_payloads(4, "jira:123", provider="jira")
        cache.add("wh:drain_active:jira:123", 1, timeout=15)

        drain_mailbox(
            records[0].id, claimed_count=3, valid_until=fresh_deadline(), mailbox="jira:123"
        )

        mock_drain.delay.assert_not_called()
        # The other dispatcher's guard must survive the skipped chain.
        assert cache.get("wh:drain_active:jira:123") is not None


@control_silo_test
class PushTriggerTest(MetricCallsMixin, TestCase):
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_enqueues_drain_for_idle_mailbox(self, mock_drain: MagicMock) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        maybe_trigger_drain(webhook.mailbox_name)
        mock_drain.delay.assert_called_once_with(
            payload_id=webhook.id,
            claimed_count=1,
            dispatcher=Dispatcher.PUSH,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )
        # The batch is claimed before dispatch; the claim is what keeps other
        # dispatchers off the mailbox while the drain runs.
        webhook.refresh_from_db()
        assert webhook.schedule_for > timezone.now()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_claims_whole_batch(self, mock_drain: MagicMock) -> None:
        records = create_payloads(3, "github:123")

        maybe_trigger_drain("github:123")

        for record in records:
            record.refresh_from_db()
            assert record.schedule_for > timezone.now()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_deduplicates_concurrent_webhooks(self, mock_drain: MagicMock) -> None:
        webhook_one = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        webhook_two = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        maybe_trigger_drain(webhook_one.mailbox_name)
        # The claim guard is released as soon as dispatch happens; dedupe of the
        # second call comes from the claim, not the lock.
        assert cache.get(f"wh:drain_active:{webhook_one.mailbox_name}") is None
        maybe_trigger_drain(webhook_two.mailbox_name)
        assert mock_drain.delay.call_count == 1

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_drains_from_mailbox_head_not_new_payload(
        self, mock_drain: MagicMock
    ) -> None:
        # Older payload is already in the mailbox (e.g. waiting for a retry window)
        older_webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        newer_webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        # Trigger with the newer webhook's ID, as get_response_from_webhookpayload does
        maybe_trigger_drain(newer_webhook.mailbox_name)
        # Must drain from the head of the mailbox so the older payload is not skipped
        mock_drain.delay.assert_called_once_with(
            payload_id=older_webhook.id,
            claimed_count=2,
            dispatcher=Dispatcher.PUSH,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_allows_new_drain_after_claim_expires(self, mock_drain: MagicMock) -> None:
        webhook_one = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        maybe_trigger_drain(webhook_one.mailbox_name)
        assert mock_drain.delay.call_count == 1

        # The drain never ran (mocked); wind the claim back as if its horizon passed.
        WebhookPayload.objects.filter(mailbox_name=webhook_one.mailbox_name).update(
            schedule_for=timezone.now() - timedelta(seconds=1)
        )

        maybe_trigger_drain(webhook_one.mailbox_name)
        assert mock_drain.delay.call_count == 2

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(DUE_HEAD_OPTIONS)
    def test_push_trigger_due_head_dispatches_past_backoff_head(
        self, mock_drain: MagicMock
    ) -> None:
        self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )
        due = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        maybe_trigger_drain("github:123")

        mock_drain.delay.assert_called_once_with(
            payload_id=due.id,
            claimed_count=1,
            dispatcher=Dispatcher.PUSH,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(DUE_HEAD_OPTIONS)
    def test_push_trigger_due_head_skips_backoff_only_mailbox(self, mock_drain: MagicMock) -> None:
        self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )
        maybe_trigger_drain("github:123")
        mock_drain.delay.assert_not_called()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_graceful_on_redis_failure(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        with patch(
            "sentry.hybridcloud.tasks.deliver_webhooks.cache.add",
            side_effect=Exception("Cache unavailable"),
        ):
            # Should not raise — the scheduler covers delivery.
            maybe_trigger_drain(webhook.mailbox_name)
        mock_drain.delay.assert_not_called()
        # No dispatch means no claim; the head must stay due for the scheduler.
        webhook.refresh_from_db()
        assert webhook.schedule_for < timezone.now()
        # Tagged apart so an outage cannot drown out a real fault.
        assert self.tags_for(mock_metrics, PUSH_TRIGGER_ERROR_METRIC) == [
            {"provider": "github", "reason": "cache_unavailable"}
        ]

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_releases_guard_when_enqueue_fails(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        mock_drain.delay.side_effect = Exception("broker down")

        # Should not raise
        maybe_trigger_drain(webhook.mailbox_name)

        # The guard must not outlive the trigger even when enqueueing fails.
        assert cache.get(f"wh:drain_active:{webhook.mailbox_name}") is None
        assert self.tags_for(mock_metrics, PUSH_TRIGGER_ERROR_METRIC) == [
            {"provider": "github", "reason": "dispatch_failed"}
        ]
        # The claim stands, so the batch waits out its horizon (≤3 min) before any
        # dispatcher retries — the same failure mode the scheduler path has.
        webhook.refresh_from_db()
        assert webhook.schedule_for > timezone.now()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_scheduler_skips_locked_mailboxes(self, mock_drain: MagicMock) -> None:
        webhook_a = self.create_webhook_payload(mailbox_name="github:111", cell_name="us")
        webhook_b = self.create_webhook_payload(mailbox_name="github:222", cell_name="us")

        # Simulate a dispatcher mid-claim for mailbox A
        cache.set(f"wh:drain_active:{webhook_a.mailbox_name}", 1, timeout=15)

        schedule_webhook_delivery()

        # Only mailbox B should have been scheduled
        mock_drain.delay.assert_called_once_with(
            payload_id=webhook_b.id,
            claimed_count=1,
            dispatcher=Dispatcher.SCHEDULER,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_scheduler_releases_claim_guard(self, mock_drain: MagicMock) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        schedule_webhook_delivery()

        assert mock_drain.delay.call_count == 1
        # The guard only serializes the claim; new webhooks must be able to trigger
        # as soon as scheduling is done.
        assert cache.get(f"wh:drain_active:{webhook.mailbox_name}") is None

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_scheduler_claims_and_dispatches_when_cache_down(self, mock_drain: MagicMock) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        with patch(
            "sentry.hybridcloud.tasks.deliver_webhooks.cache.add",
            side_effect=Exception("Cache unavailable"),
        ):
            schedule_webhook_delivery()

        # The guard is best-effort; claims alone keep dispatchers apart across
        # cycles, so a cache outage must not stop scheduled delivery.
        assert mock_drain.delay.call_count == 1
        webhook.refresh_from_db()
        assert webhook.schedule_for > timezone.now()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @responses.activate
    @override_cells(cell_config)
    def test_push_trigger_fires_immediately_after_drain_completes(
        self, mock_drain: MagicMock
    ) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook_one = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        drain_mailbox(
            webhook_one.id,
            claimed_count=MAX_MAILBOX_DRAIN,
            valid_until=fresh_deadline(),
            mailbox="github:123",
        )

        # The drain emptied the mailbox; a new webhook arriving now must be able to
        # trigger a fresh drain right away.
        webhook_two = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        maybe_trigger_drain(webhook_two.mailbox_name)
        mock_drain.delay.assert_called_once_with(
            payload_id=webhook_two.id,
            claimed_count=1,
            dispatcher=Dispatcher.PUSH,
            valid_until=ANY,
            mailbox=ANY,
            chain_depth=1,
        )

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_skips_drain_when_head_is_in_backoff(self, mock_drain: MagicMock) -> None:
        from datetime import timedelta

        from django.core.cache import cache
        from django.utils import timezone

        # Create a payload whose head is in a retry backoff window
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        webhook.update(schedule_for=timezone.now() + timedelta(minutes=5))

        maybe_trigger_drain(webhook.mailbox_name)

        # No drain should be enqueued — head is not ready
        mock_drain.delay.assert_not_called()
        # Lock must also be released so the scheduler can pick it up when backoff expires
        assert cache.get(f"wh:drain_active:{webhook.mailbox_name}") is None

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_claim_keeps_scheduler_off(self, mock_drain: MagicMock) -> None:
        create_payloads(3, "github:123")

        maybe_trigger_drain("github:123")
        assert mock_drain.delay.call_count == 1

        schedule_webhook_delivery()

        # The push trigger's claim moved the head past the drain deadline, so the
        # scheduler must not double-dispatch a drain for this mailbox.
        assert mock_drain.delay.call_count == 1

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_scheduler_claim_blocks_push_trigger(self, mock_drain: MagicMock) -> None:
        create_payloads(3, "github:123")

        schedule_webhook_delivery()
        assert mock_drain.delay.call_count == 1

        maybe_trigger_drain("github:123")

        # The scheduler's claim covers the mailbox; the push trigger must not
        # dispatch a second drain.
        assert mock_drain.delay.call_count == 1

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_claim_guard_keeps_the_short_ttl(self, mock_drain: MagicMock) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        with patch.object(cache, "add", wraps=cache.add) as mock_add:
            maybe_trigger_drain(webhook.mailbox_name)

        # The trigger releases the lock before returning. Sizing its TTL for a delivery
        # would strand the mailbox that long whenever a dispatcher dies mid-claim.
        assert mock_add.call_args.kwargs["timeout"] == DRAIN_LOCK_TTL

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_trigger_respects_held_lock(self, mock_drain: MagicMock) -> None:
        # Another dispatcher is mid-claim and holds the lock; this trigger must
        # not dispatch over it.
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        cache.add(f"wh:drain_active:{webhook.mailbox_name}", 1, timeout=15)

        maybe_trigger_drain(webhook.mailbox_name)

        mock_drain.delay.assert_not_called()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_trigger_respects_active_claim(self, mock_drain: MagicMock) -> None:
        # Another dispatcher's claim has the batch scheduled into the future, so
        # this trigger sees the head as not due.
        webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            schedule_for=timezone.now() + timedelta(minutes=3),
        )

        maybe_trigger_drain(webhook.mailbox_name)

        mock_drain.delay.assert_not_called()
        # The trigger must release its guard so the mailbox stays reachable.
        assert cache.get(f"wh:drain_active:{webhook.mailbox_name}") is None
