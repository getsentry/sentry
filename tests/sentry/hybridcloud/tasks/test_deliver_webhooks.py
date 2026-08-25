from collections.abc import Callable
from datetime import timedelta
from typing import Any
from unittest.mock import MagicMock, PropertyMock, patch

import orjson
import pytest
import responses
from django.core.cache import cache
from django.db import connections
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from requests.exceptions import ConnectionError, ReadTimeout

from sentry import options
from sentry.hybridcloud.models.webhookpayload import MAX_ATTEMPTS, WebhookPayload
from sentry.hybridcloud.tasks import deliver_webhooks
from sentry.hybridcloud.tasks.deliver_webhooks import (
    DRAIN_LOCK_TTL,
    MAX_MAILBOX_DRAIN,
    PARALLEL_DRAIN_THRESHOLD,
    SLOW_DELIVERY_THRESHOLD,
    Dispatcher,
    _claim_and_dispatch,
    drain_mailbox,
    drain_mailbox_parallel,
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

# Drains invoked directly carry no dispatcher attribution; `_dispatch_tags`
# tags them rather than omitting the key, so the tag stays queryable.
UNATTRIBUTED = {"dispatcher": "unknown"}

PUSH_TRIGGER_OPTIONS = {"hybridcloud.webhookpayload.push_drain_trigger": True}
cell_config_with_gateway = [
    Cell(
        name="us",
        snowflake_id=1,
        address="http://us.testserver",
        api_gateway_address="http://sentry-rpc-gateway",
    )
]


@control_silo_test
class ScheduleWebhooksTest(TestCase):
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
            webhook_one.id, claimed_count=2, dispatcher=Dispatcher.SCHEDULER
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
            webhook_one.id, claimed_count=1, dispatcher=Dispatcher.SCHEDULER
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
            webhook_one.id, claimed_count=2, dispatcher=Dispatcher.SCHEDULER
        )

    @responses.activate
    @override_cells(cell_config)
    def test_schedule_mailbox_with_more_than_batch_size_records(self) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", body=ReadTimeout()
        )
        num_records = 55
        for _ in range(0, num_records):
            self.create_webhook_payload(
                mailbox_name="github:123",
                cell_name="us",
            )
        # Run the task that is spawned to provide some integration test coverage.
        with self.tasks():
            schedule_webhook_delivery()

        # First attempt fails. provider=None is not in the skip-on-failure allowlist
        # so processing stops after the first message, preserving mailbox ordering.
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

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel")
    def test_schedule_mailbox_parallel_task(self, mock_deliver: MagicMock) -> None:
        for _ in range(0, int(MAX_MAILBOX_DRAIN / 3 + 1)):
            self.create_webhook_payload(
                mailbox_name="github:123",
                cell_name="us",
            )
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 1

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_claim_and_dispatch_skips_head_claimed_on_primary(
        self, mock_drain: MagicMock, mock_drain_parallel: MagicMock
    ) -> None:
        # The scheduler discovers mailbox heads on the replica, which can lag behind
        # another dispatcher's claim on the primary. The primary re-check must stop
        # the stale head from double-dispatching a drain.
        claimed_for = timezone.now() + timedelta(minutes=3)
        webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            schedule_for=claimed_for,
        )

        outcome = _claim_and_dispatch(
            webhook.id, webhook.mailbox_name, dispatcher=Dispatcher.SCHEDULER
        )

        assert outcome == "not_due"
        mock_drain.delay.assert_not_called()
        mock_drain_parallel.delay.assert_not_called()
        webhook.refresh_from_db()
        # The existing claim must not be extended either.
        assert webhook.schedule_for == claimed_for

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_claim_and_dispatch_claims_in_a_single_query(
        self, mock_drain: MagicMock, mock_drain_parallel: MagicMock
    ) -> None:
        # The due-gate rides in the claim UPDATE's WHERE clause. A separate
        # primary read before the claim would double the per-mailbox dispatch
        # round trips, so lock in the single-statement shape.
        webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
        )

        with CaptureQueriesContext(connections["control"]) as ctx:
            outcome = _claim_and_dispatch(
                webhook.id, webhook.mailbox_name, dispatcher=Dispatcher.SCHEDULER
            )

        assert outcome == "sequential"
        mock_drain.delay.assert_called_once_with(
            webhook.id, claimed_count=1, dispatcher=Dispatcher.SCHEDULER
        )
        queries = [
            q["sql"]
            for q in ctx.captured_queries
            if not q["sql"].startswith(("SAVEPOINT", "RELEASE SAVEPOINT"))
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
        call_args_list = [call[0][0] for call in mock_deliver.delay.call_args_list]

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
        call_args_list = [call[0][0] for call in mock_deliver.delay.call_args_list]

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
        call_args_list = [call[0][0] for call in mock_deliver.delay.call_args_list]

        # Stripe (priority 1) should be first
        assert call_args_list[0] == stripe_webhook.id
        # Null provider (default priority) should be last
        assert call_args_list[1] == null_provider_webhook.id


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


def assert_drain_skips_failed_message(drain: Callable[[int, int], None], provider: str) -> None:
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

    drain(records[0].id, MAX_MAILBOX_DRAIN)

    assert len(responses.calls) == 5
    assert WebhookPayload.objects.count() == 1

    remaining = WebhookPayload.objects.get()
    assert remaining.provider == provider
    assert remaining.attempts == 1
    assert remaining.schedule_for > timezone.now()


@control_silo_test
class DrainMailboxTest(TestCase):
    @responses.activate
    def test_drain_missing_payload(self) -> None:
        drain_mailbox(99, claimed_count=MAX_MAILBOX_DRAIN)
        assert len(responses.calls) == 0

    @responses.activate
    def test_drain_unknown_region(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="lolnope",
        )
        with pytest.raises(CellResolutionError):
            drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

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
    def test_drain_stops_at_claimed_count(self) -> None:
        # A claim-mode drain holds no lock while running: delivering past its
        # claimed records would race a drain another dispatcher may have started
        # for the (due-again) mailbox head. It must stop at the claim boundary.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(8, "github:123", provider="github")

        drain_mailbox(records[0].id, claimed_count=5)

        assert len(responses.calls) == 5
        remaining = set(WebhookPayload.objects.values_list("id", flat=True))
        assert remaining == {records[5].id, records[6].id, records[7].id}

    @responses.activate
    @override_cells(cell_config)
    def test_drain_discards_stale_rows_instead_of_delivering(self) -> None:
        # MAX_DELIVERY_AGE applies to sequential drains too: stale rows are
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
        drain_mailbox(head.id, claimed_count=MAX_MAILBOX_DRAIN)

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
        drain_mailbox(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

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
        assert_drain_skips_failed_message(drain_mailbox, "github_enterprise")

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_bitbucket(self) -> None:
        assert_drain_skips_failed_message(drain_mailbox, "bitbucket")

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_bitbucket_server(self) -> None:
        assert_drain_skips_failed_message(drain_mailbox, "bitbucket_server")

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_gitlab(self) -> None:
        assert_drain_skips_failed_message(drain_mailbox, "gitlab")

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.drain_batch_deletes": True})
    def test_drain_batch_deletes_delivered_rows(self) -> None:
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(4, "github:123", provider="github")

        with CaptureQueriesContext(connections["control"]) as ctx:
            drain_mailbox(records[0].id, claimed_count=4)

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

        drain_mailbox(records[0].id, claimed_count=5)

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
            drain_mailbox(stale.id, claimed_count=4)

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
            drain_mailbox(records[0].id, claimed_count=5)

        assert WebhookPayload.objects.count() == 0
        # Two full batches during the walk plus the remainder at the end.
        delete_queries = [q["sql"] for q in ctx.captured_queries if q["sql"].startswith("DELETE")]
        assert len(delete_queries) == 3

    @responses.activate
    @override_cells(cell_config)
    def test_drain_mailbox_multiple_consecutive_failures(self) -> None:
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=500, body="")
        records = create_payloads(5, "github:123", provider="github")
        drain_mailbox(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

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
        drain_mailbox(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

        # Mailbox should be empty
        assert not WebhookPayload.objects.filter().exists()

    @responses.activate
    @override_cells(cell_config)
    def test_drain_time_limit(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        records = create_payloads(1, "github:123")
        with patch.object(
            deliver_webhooks,
            "BATCH_SCHEDULE_OFFSET",
            new_callable=PropertyMock(return_value=timedelta(minutes=0)),
        ):
            drain_mailbox(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

        # Once start time + batch offset is in the past we stop delivery
        assert WebhookPayload.objects.count() == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_too_many_attempts(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            attempts=MAX_ATTEMPTS,
        )
        drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
            drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)

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
        drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

        # Mailbox should be empty
        assert not WebhookPayload.objects.filter().exists()


@control_silo_test
class DrainMailboxParallelTest(TestCase):
    @responses.activate
    def test_drain_missing_payload(self) -> None:
        drain_mailbox_parallel(99, claimed_count=MAX_MAILBOX_DRAIN)
        assert len(responses.calls) == 0

    @responses.activate
    def test_drain_unknown_cell(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="lolnope",
        )
        with pytest.raises(CellResolutionError):
            drain_mailbox_parallel(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
        assert len(responses.calls) == 0

    @responses.activate
    @override_cells(cell_config)
    def test_drain_stops_at_claimed_count(self) -> None:
        # Mirrors DrainMailboxTest.test_drain_stops_at_claimed_count: a
        # claim-mode parallel drain must not deliver past its claimed records.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(8, "github:123", provider="github")

        drain_mailbox_parallel(records[0].id, claimed_count=5)

        assert len(responses.calls) == 5
        remaining = set(WebhookPayload.objects.values_list("id", flat=True))
        assert remaining == {records[5].id, records[6].id, records[7].id}

    @responses.activate
    @override_cells(cell_config)
    def test_drain_stale_discards_consume_claim_budget(self) -> None:
        # Stale rows are discarded inside the walk, so they consume claim budget
        # like delivered rows. Deleting them out-of-band would leave the budget
        # to spill onto unclaimed due rows — the overlap claimed_count prevents.
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

        # The claim covered the 3 stale rows plus 2 fresh ones.
        drain_mailbox_parallel(stale[0].id, claimed_count=5)

        # The 3 stale rows are discarded without requests and only the 2 claimed
        # fresh rows are delivered; the rest stay for the next claim.
        assert len(responses.calls) == 2
        remaining_ids = set(WebhookPayload.objects.values_list("id", flat=True))
        assert remaining_ids == {fresh[2].id, fresh[3].id, fresh[4].id}

    @responses.activate
    @override_cells(cell_config)
    def test_drain_success_partial(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=500,
            body="",
        )
        # provider=None is not in the skip-on-failure allowlist.
        records = create_payloads(5, "github:123")
        drain_mailbox_parallel(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

        worker_threads = options.get("hybridcloud.webhookpayload.worker_threads")
        # We'll attempt one thread batch, but the second+ will fail and stop the drain.
        assert len(responses.calls) == worker_threads

        # Mailbox should have 4 records left
        assert WebhookPayload.objects.count() == 4

        # Remaining record should be scheduled to run later.
        first = WebhookPayload.objects.order_by("id").first()
        assert first
        assert first.attempts == 1
        assert first.schedule_for > timezone.now()

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_for_allowlisted_provider(self) -> None:
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=500, body="")
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(5, "github:123", provider="github")
        drain_mailbox_parallel(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

        # github is in the skip-on-failure allowlist: failed messages are skipped
        # and processing continues across parallel batches.
        assert len(responses.calls) == 5

        # Only the failed message remains in the mailbox.
        assert WebhookPayload.objects.count() == 1

        first = WebhookPayload.objects.order_by("id").first()
        assert first
        assert first.attempts == 1
        assert first.schedule_for > timezone.now()

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.drain_batch_deletes": True})
    def test_drain_batch_deletes_span_threadpool_batches(self) -> None:
        # The batch belongs to the drain, not to one threadpool batch: a
        # threadpool only runs worker_threads (4) rows at a time, so accumulating
        # per threadpool batch would cap every DELETE at that width.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        records = create_payloads(8, "github:123", provider="github")

        with CaptureQueriesContext(connections["control"]) as ctx:
            drain_mailbox_parallel(records[0].id, claimed_count=8)

        assert len(responses.calls) == 8
        assert WebhookPayload.objects.count() == 0
        delete_queries = [q["sql"] for q in ctx.captured_queries if q["sql"].startswith("DELETE")]
        assert len(delete_queries) == 1

    @responses.activate
    @override_cells(cell_config)
    @override_options({"hybridcloud.webhookpayload.drain_batch_deletes": True})
    def test_drain_batch_deletes_discarded_rows(self) -> None:
        # Stale rows are discarded before the threadpool runs, so they would
        # otherwise be the one delete path the batch never covers.
        url = "http://us.testserver/extensions/github/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        stale = [
            Factories.create_webhook_payload(
                mailbox_name="github:123",
                cell_name="us",
                provider="github",
                request_path="/extensions/github/webhook/",
                date_added=timezone.now() - timedelta(days=4),
            )
            for _ in range(2)
        ]
        create_payloads(2, "github:123", provider="github")

        with CaptureQueriesContext(connections["control"]) as ctx:
            drain_mailbox_parallel(stale[0].id, claimed_count=4)

        assert len(responses.calls) == 2
        assert WebhookPayload.objects.count() == 0
        delete_queries = [q["sql"] for q in ctx.captured_queries if q["sql"].startswith("DELETE")]
        assert len(delete_queries) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_stops_on_failure_for_non_allowlisted_provider(self) -> None:
        url = "http://us.testserver/extensions/jira/webhook/"
        responses.add(responses.POST, url, status=200, body="")
        responses.add(responses.POST, url, status=500, body="")
        records = create_payloads(5, "jira:123", provider="jira")
        drain_mailbox_parallel(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

        worker_threads = options.get("hybridcloud.webhookpayload.worker_threads")
        # jira is not in the allowlist: processing stops after the first batch
        # that encounters a retryable failure.
        assert len(responses.calls) == worker_threads
        assert WebhookPayload.objects.count() == 4

        first = WebhookPayload.objects.order_by("id").first()
        assert first
        assert first.attempts == 1
        assert first.schedule_for > timezone.now()

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_github_enterprise(self) -> None:
        assert_drain_skips_failed_message(drain_mailbox_parallel, "github_enterprise")

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_bitbucket(self) -> None:
        assert_drain_skips_failed_message(drain_mailbox_parallel, "bitbucket")

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_bitbucket_server(self) -> None:
        assert_drain_skips_failed_message(drain_mailbox_parallel, "bitbucket_server")

    @responses.activate
    @override_cells(cell_config)
    def test_drain_skip_on_failure_gitlab(self) -> None:
        assert_drain_skips_failed_message(drain_mailbox_parallel, "gitlab")

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
        drain_mailbox_parallel(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

        # Mailbox should be empty
        assert not WebhookPayload.objects.filter().exists()

    @responses.activate
    @override_cells(cell_config)
    def test_drain_time_limit(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        records = create_payloads(1, "github:123")
        with patch.object(
            deliver_webhooks,
            "BATCH_SCHEDULE_OFFSET",
            new_callable=PropertyMock(return_value=timedelta(minutes=0)),
        ):
            drain_mailbox_parallel(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

        # Once start time + batch offset is in the past we stop delivery
        assert WebhookPayload.objects.count() == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_discard_old_messages(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        records = create_payloads(20, "github:123")

        # Make old records
        for record in records:
            record.date_added = timezone.now() - timedelta(days=4)
            record.save()

        drain_mailbox_parallel(records[0].id, claimed_count=MAX_MAILBOX_DRAIN)

        # Mailbox should be empty
        assert not WebhookPayload.objects.filter().exists()
        # No requests sent because records are too old
        assert len(responses.calls) == 0

    @responses.activate
    @override_cells(cell_config)
    def test_drain_too_many_attempts(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=500,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            attempts=MAX_ATTEMPTS,
        )
        drain_mailbox_parallel(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_more_than_max_attempts(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            cell_name="us",
            attempts=MAX_ATTEMPTS + 1,
        )
        drain_mailbox_parallel(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 1

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
            drain_mailbox_parallel(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox_parallel(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert len(responses.calls) == 1

    @responses.activate
    @override_cells(cell_config)
    def test_drain_conflict(self) -> None:
        # Getting a conflict back from the region silo means
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
        drain_mailbox_parallel(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox_parallel(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
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
        drain_mailbox_parallel(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        # We don't retry 400
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
        drain_mailbox_parallel(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)

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
        drain_mailbox_parallel(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert hook.schedule_for > timezone.now()
        assert hook.attempts == 1

        assert len(responses.calls) == 1


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
            drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

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
class DeliveryTimeMetricsTest(TestCase):
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
        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        delivery_time_ms_calls = [
            c
            for c in mock_metrics.distribution.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.delivery_time_ms"
        ]
        assert len(delivery_time_ms_calls) == 1
        tags = delivery_time_ms_calls[0][1].get("tags", {})
        assert tags.get("region_sent_to") == "us"
        # Rows predating the provider column still drain through here.
        assert tags.get("provider") == "unknown"
        assert tags.get("event_type") == "none"
        # A drain with no dispatcher still emits the attribution key; a tag
        # missing from some series breaks grouping rather than showing a gap.
        assert tags.get("dispatcher") == "unknown"

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_delivery_time_metrics_github_event_and_action(self, mock_metrics: MagicMock) -> None:
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
            request_headers=orjson.dumps(
                {"X-GitHub-Event": "pull_request", "Content-Type": "application/json"}
            ).decode(),
            request_body=orjson.dumps({"action": "opened", "repository": {}}).decode(),
        )
        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        delivery_time_ms_calls = [
            c
            for c in mock_metrics.distribution.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.delivery_time_ms"
        ]
        assert len(delivery_time_ms_calls) == 1
        tags = delivery_time_ms_calls[0][1].get("tags", {})
        assert tags.get("region_sent_to") == "us"
        assert tags.get("provider") == "github"
        assert tags.get("event_type") == "pull_request"
        # Both tags emit while consumers migrate off the unbounded one.
        assert tags.get("github_event_and_action") == "pull_request.opened"

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_delivery_time_metrics_github_event_only(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123:0:push",
            cell_name="us",
            provider="github",
            request_headers=orjson.dumps(
                {"X-GitHub-Event": "push", "Content-Type": "application/json"}
            ).decode(),
            request_body=orjson.dumps({"repository": {}}).decode(),
        )
        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        delivery_time_ms_calls = [
            c
            for c in mock_metrics.distribution.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.delivery_time_ms"
        ]
        assert len(delivery_time_ms_calls) == 1
        tags = delivery_time_ms_calls[0][1].get("tags", {})
        assert tags.get("region_sent_to") == "us"
        assert tags.get("event_type") == "push"
        assert tags.get("github_event_and_action") == "push.unknown"

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_delivery_time_metrics_non_github_no_github_tags(self, mock_metrics: MagicMock) -> None:
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
        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        delivery_time_ms_calls = [
            c
            for c in mock_metrics.distribution.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.delivery_time_ms"
        ]
        assert len(delivery_time_ms_calls) == 1
        tags = delivery_time_ms_calls[0][1].get("tags", {})
        assert tags.get("region_sent_to") == "us"
        assert tags.get("provider") == "stripe"
        assert tags.get("event_type") == "none"
        assert "github_event_and_action" not in tags

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
        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        delivery_time_ms_calls = [
            c
            for c in mock_metrics.distribution.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.delivery_time_ms"
        ]
        assert len(delivery_time_ms_calls) == 1
        tags = delivery_time_ms_calls[0][1].get("tags", {})
        assert tags.get("provider") == "github"
        assert tags.get("event_type") == "unknown"


@control_silo_test
class DroppedDeliveryOutcomeTest(TestCase):
    """
    A payload the cell permanently rejects is deleted just like a delivered one, so
    it must not be reported as a delivery.
    """

    def delivery_outcomes(self, mock_metrics: MagicMock) -> list[str]:
        return [
            c[1]["tags"]["outcome"]
            for c in mock_metrics.incr.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.delivery"
        ]

    def delivery_time_calls(self, mock_metrics: MagicMock) -> list[Any]:
        return [
            c
            for c in mock_metrics.distribution.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.delivery_time_ms"
        ]

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

        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert not WebhookPayload.objects.filter(id=webhook.id).exists()
        assert self.delivery_outcomes(mock_metrics) == ["conflict"]
        assert self.delivery_time_calls(mock_metrics) == []

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

        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert not WebhookPayload.objects.filter(id=webhook.id).exists()
        assert self.delivery_outcomes(mock_metrics) == ["dropped_4xx"]
        assert self.delivery_time_calls(mock_metrics) == []

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

        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert self.delivery_outcomes(mock_metrics) == ["ok"]
        assert len(self.delivery_time_calls(mock_metrics)) == 1

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_parallel_conflict_not_counted_as_delivered(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=409,
            body="",
        )
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        drain_mailbox_parallel(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert not WebhookPayload.objects.filter(id=webhook.id).exists()
        assert self.delivery_outcomes(mock_metrics) == ["conflict"]
        assert self.delivery_time_calls(mock_metrics) == []

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_parallel_unauthorized_not_counted_as_delivered(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=401,
            body="",
        )
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        drain_mailbox_parallel(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert not WebhookPayload.objects.filter(id=webhook.id).exists()
        assert self.delivery_outcomes(mock_metrics) == ["dropped_4xx"]
        assert self.delivery_time_calls(mock_metrics) == []

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_dropped_payload_does_not_stall_ordered_mailbox(self, mock_metrics: MagicMock) -> None:
        # A drop is terminal, not a retryable failure, so the drain must continue
        # past it even for providers that stop on the first failure.
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=401,
            body="",
        )
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        first = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        second = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        drain_mailbox(first.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert not WebhookPayload.objects.filter(id=second.id).exists()
        assert self.delivery_outcomes(mock_metrics) == ["dropped_4xx", "ok"]


@control_silo_test
class ProviderMetricTagTest(TestCase):
    """
    The `$provider` dashboard selector filters on this tag, so a delivery metric
    emitted without it silently disappears when a provider is selected.
    """

    def tags_for(self, mock_metrics: MagicMock, metric: str) -> list[dict[str, str]]:
        return [c[1].get("tags", {}) for c in mock_metrics.incr.call_args_list if c[0][0] == metric]

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

        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert self.tags_for(mock_metrics, "hybridcloud.deliver_webhooks.delivery") == [
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

        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

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

        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert self.tags_for(mock_metrics, "hybridcloud.deliver_webhooks.delivery") == [
            {**UNATTRIBUTED, "outcome": "conflict", "provider": "github"}
        ]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_parallel_dropped_outcome_tagged_with_provider(self, mock_metrics: MagicMock) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=401,
            body="",
        )
        webhook = self.create_webhook_payload(
            mailbox_name="github:123", cell_name="us", provider="github"
        )

        drain_mailbox_parallel(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert self.tags_for(mock_metrics, "hybridcloud.deliver_webhooks.delivery") == [
            {**UNATTRIBUTED, "outcome": "dropped_4xx", "provider": "github"}
        ]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_provider_falls_back_to_unknown(self, mock_metrics: MagicMock) -> None:
        # Rows predating the provider column still drain through here.
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        webhook.update(provider=None)

        drain_mailbox(webhook.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert self.tags_for(mock_metrics, "hybridcloud.deliver_webhooks.delivery") == [
            {**UNATTRIBUTED, "outcome": "ok", "provider": "unknown"}
        ]

    @override_options(PUSH_TRIGGER_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_trigger_provider_from_mailbox_name(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        # No payload row is loaded on this path, so the provider comes from the name.
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        maybe_trigger_drain(webhook.mailbox_name)

        assert self.tags_for(mock_metrics, "hybridcloud.deliver_webhooks.push_trigger.success") == [
            {"provider": "github", "drain": "sequential"}
        ]

    @responses.activate
    @override_cells(cell_config)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_retry_tagged_from_failing_record_not_mailbox_head(
        self, mock_metrics: MagicMock
    ) -> None:
        # The sequential drain loops over records but holds a separate reference to
        # the mailbox head, so `retry` must read the record that actually failed.
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            body=ReadTimeout(),
        )
        head = self.create_webhook_payload(
            mailbox_name="github:123", cell_name="us", provider="github"
        )
        legacy = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        legacy.update(provider=None)

        drain_mailbox(head.id, claimed_count=MAX_MAILBOX_DRAIN)

        assert self.tags_for(mock_metrics, "hybridcloud.deliver_webhooks.delivery") == [
            {**UNATTRIBUTED, "outcome": "ok", "provider": "github"},
            {**UNATTRIBUTED, "outcome": "retry", "provider": "unknown"},
        ]


@control_silo_test
class DispatchMetricTest(TestCase):
    """
    One test per dispatch path: a path that stops emitting silently attributes its
    work to the other dispatcher.
    """

    def dispatch_tags(self, mock_metrics: MagicMock) -> list[dict[str, str]]:
        return [
            c[1].get("tags", {})
            for c in mock_metrics.incr.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.dispatch"
        ]

    def claimed_calls(self, mock_metrics: MagicMock) -> list[tuple[int, dict[str, str]]]:
        return [
            (c[0][1], c[1].get("tags", {}))
            for c in mock_metrics.distribution.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.dispatch.claimed"
        ]

    @override_options(PUSH_TRIGGER_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_push_dispatch_attributed_to_push(
        self, mock_drain: MagicMock, mock_metrics: MagicMock
    ) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        maybe_trigger_drain(webhook.mailbox_name)

        assert mock_drain.delay.call_args.kwargs["dispatcher"] == Dispatcher.PUSH
        assert self.dispatch_tags(mock_metrics) == [
            {"dispatcher": "push", "drain": "sequential", "provider": "github"}
        ]
        assert self.claimed_calls(mock_metrics) == [
            (1, {"dispatcher": "push", "drain": "sequential", "provider": "github"})
        ]

    @override_options(PUSH_TRIGGER_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel")
    def test_scheduler_dispatch_reports_batch_depth(
        self, mock_drain_parallel: MagicMock, mock_metrics: MagicMock
    ) -> None:
        # Deep on purpose: `claimed` must report the batch, not one per dispatch,
        # or webhook share collapses back into dispatch share.
        for _ in range(PARALLEL_DRAIN_THRESHOLD):
            self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        schedule_webhook_delivery()

        assert mock_drain_parallel.delay.call_args.kwargs["dispatcher"] == Dispatcher.SCHEDULER
        assert self.dispatch_tags(mock_metrics) == [
            {"dispatcher": "scheduler", "drain": "parallel", "provider": "github"}
        ]
        assert self.claimed_calls(mock_metrics) == [
            (
                PARALLEL_DRAIN_THRESHOLD,
                {"dispatcher": "scheduler", "drain": "parallel", "provider": "github"},
            )
        ]


@control_silo_test
class DeliveryDispatchTagTest(TestCase):
    """
    Delivery outcomes carry the attribution of the drain that produced them, so
    push- and scheduler-dispatched work stay separable rather than collapsing
    into one global total.
    """

    def delivery_tags(self, mock_metrics: MagicMock) -> list[dict[str, str]]:
        return [
            c[1].get("tags", {})
            for c in mock_metrics.incr.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.delivery"
        ]

    def delivery_time_tags(self, mock_metrics: MagicMock) -> list[dict[str, str]]:
        return [
            c[1].get("tags", {})
            for c in mock_metrics.distribution.call_args_list
            if c[0][0] == "hybridcloud.deliver_webhooks.delivery_time_ms"
        ]

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

        drain_mailbox(webhook.id, claimed_count=1, dispatcher=Dispatcher.SCHEDULER)

        # `claim_exhausted` has no provider tag, so it is the outcome most likely
        # to be missed when attribution is added; assert it alongside the delivery.
        assert self.delivery_tags(mock_metrics) == [
            {"dispatcher": "scheduler", "outcome": "ok", "provider": "github"},
            {"dispatcher": "scheduler", "outcome": "claim_exhausted"},
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

        drain_mailbox(webhook.id, claimed_count=1, dispatcher=Dispatcher.SCHEDULER)

        assert self.delivery_time_tags(mock_metrics) == [
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
    def test_parallel_delivery_time_carries_dispatch_attribution(
        self, mock_metrics: MagicMock
    ) -> None:
        # The parallel path records latency from its own callsite, so it can lose
        # attribution independently of the sequential one.
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        records = create_payloads(2, "github:123", provider="github")

        drain_mailbox_parallel(records[0].id, claimed_count=2, dispatcher=Dispatcher.PUSH)

        expected = {
            "dispatcher": "push",
            "region_sent_to": "us",
            "provider": "github",
            "event_type": "unknown",
        }
        assert self.delivery_time_tags(mock_metrics) == [expected, expected]

    @responses.activate
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_race_outcome_carries_dispatch_attribution(self, mock_metrics: MagicMock) -> None:
        # A race means the row is already gone, so the outcome carries no provider
        # and attribution is all that is left to tell the dispatchers apart.
        drain_mailbox(99, claimed_count=1, dispatcher=Dispatcher.PUSH)

        assert self.delivery_tags(mock_metrics) == [
            {"dispatcher": "push", "outcome": "race", "provider": "unknown"}
        ]

    @responses.activate
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_parallel_drain_carries_dispatch_attribution(self, mock_metrics: MagicMock) -> None:
        drain_mailbox_parallel(99, claimed_count=1, dispatcher=Dispatcher.SCHEDULER)

        assert self.delivery_tags(mock_metrics) == [
            {"dispatcher": "scheduler", "outcome": "race", "provider": "unknown"}
        ]

    @responses.activate
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.metrics")
    def test_drain_enqueued_before_deploy_tags_unknown(self, mock_metrics: MagicMock) -> None:
        # Tasks already queued when this deploys arrive without a dispatcher. The
        # key must still be emitted: a tag absent from some series breaks grouping
        # rather than showing a gap.
        drain_mailbox(99, claimed_count=1)

        assert self.delivery_tags(mock_metrics) == [
            {**UNATTRIBUTED, "outcome": "race", "provider": "unknown"}
        ]


@control_silo_test
class PushTriggerTest(TestCase):
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
    def test_push_trigger_enqueues_drain_for_idle_mailbox(self, mock_drain: MagicMock) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        maybe_trigger_drain(webhook.mailbox_name)
        mock_drain.delay.assert_called_once_with(
            webhook.id, claimed_count=1, dispatcher=Dispatcher.PUSH
        )
        # The batch is claimed before dispatch; the claim is what keeps other
        # dispatchers off the mailbox while the drain runs.
        webhook.refresh_from_db()
        assert webhook.schedule_for > timezone.now()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
    def test_push_trigger_claims_whole_batch(self, mock_drain: MagicMock) -> None:
        records = create_payloads(3, "github:123")

        maybe_trigger_drain("github:123")

        for record in records:
            record.refresh_from_db()
            assert record.schedule_for > timezone.now()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
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
    @override_options(PUSH_TRIGGER_OPTIONS)
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
            older_webhook.id, claimed_count=2, dispatcher=Dispatcher.PUSH
        )

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
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
    def test_push_trigger_noop_when_option_disabled(self, mock_drain: MagicMock) -> None:
        # Option defaults to False
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        maybe_trigger_drain(webhook.mailbox_name)
        mock_drain.delay.assert_not_called()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
    def test_push_trigger_graceful_on_redis_failure(self, mock_drain: MagicMock) -> None:
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

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
    def test_push_trigger_releases_guard_when_enqueue_fails(self, mock_drain: MagicMock) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        mock_drain.delay.side_effect = Exception("broker down")

        # Should not raise
        maybe_trigger_drain(webhook.mailbox_name)

        # The guard must not outlive the trigger even when enqueueing fails.
        assert cache.get(f"wh:drain_active:{webhook.mailbox_name}") is None
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
            webhook_b.id, claimed_count=1, dispatcher=Dispatcher.SCHEDULER
        )

    @override_options(PUSH_TRIGGER_OPTIONS)
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_scheduler_releases_claim_guard(self, mock_drain: MagicMock) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        schedule_webhook_delivery()

        assert mock_drain.delay.call_count == 1
        # The guard only serializes the claim; new webhooks must be able to trigger
        # as soon as scheduling is done.
        assert cache.get(f"wh:drain_active:{webhook.mailbox_name}") is None

    @override_options(PUSH_TRIGGER_OPTIONS)
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
    @override_options(PUSH_TRIGGER_OPTIONS)
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
        drain_mailbox(webhook_one.id, claimed_count=MAX_MAILBOX_DRAIN)

        # The drain emptied the mailbox; a new webhook arriving now must be able to
        # trigger a fresh drain right away.
        webhook_two = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        maybe_trigger_drain(webhook_two.mailbox_name)
        mock_drain.delay.assert_called_once_with(
            webhook_two.id, claimed_count=1, dispatcher=Dispatcher.PUSH
        )

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
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

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
    def test_push_trigger_uses_parallel_drain_for_deep_mailbox(
        self, mock_drain: MagicMock, mock_drain_parallel: MagicMock
    ) -> None:
        records = create_payloads(PARALLEL_DRAIN_THRESHOLD, "github:123")

        maybe_trigger_drain("github:123")

        # A mailbox this deep is behind; the sequential drain would work it off at
        # one in-flight request for its whole run.
        mock_drain_parallel.delay.assert_called_once_with(
            records[0].id, claimed_count=PARALLEL_DRAIN_THRESHOLD, dispatcher=Dispatcher.PUSH
        )
        mock_drain.delay.assert_not_called()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
    def test_push_trigger_uses_sequential_drain_for_shallow_mailbox(
        self, mock_drain: MagicMock, mock_drain_parallel: MagicMock
    ) -> None:
        records = create_payloads(PARALLEL_DRAIN_THRESHOLD - 1, "github:123")

        maybe_trigger_drain("github:123")

        # One record short of the threshold keeps strict ordering.
        mock_drain.delay.assert_called_once_with(
            records[0].id, claimed_count=PARALLEL_DRAIN_THRESHOLD - 1, dispatcher=Dispatcher.PUSH
        )
        mock_drain_parallel.delay.assert_not_called()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
    def test_push_trigger_claim_keeps_scheduler_off(
        self, mock_drain: MagicMock, mock_drain_parallel: MagicMock
    ) -> None:
        create_payloads(3, "github:123")

        maybe_trigger_drain("github:123")
        assert mock_drain.delay.call_count == 1

        schedule_webhook_delivery()

        # The push trigger's claim moved the head past the drain deadline, so the
        # scheduler must not double-dispatch a drain for this mailbox.
        assert mock_drain.delay.call_count == 1
        assert mock_drain_parallel.delay.call_count == 0

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
    def test_scheduler_claim_blocks_push_trigger(
        self, mock_drain: MagicMock, mock_drain_parallel: MagicMock
    ) -> None:
        create_payloads(3, "github:123")

        schedule_webhook_delivery()
        assert mock_drain.delay.call_count == 1

        maybe_trigger_drain("github:123")

        # The scheduler's claim covers the mailbox; the push trigger must not
        # dispatch a second drain.
        assert mock_drain.delay.call_count == 1
        assert mock_drain_parallel.delay.call_count == 0

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
    def test_claim_guard_keeps_the_short_ttl(self, mock_drain: MagicMock) -> None:
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")

        with patch.object(cache, "add", wraps=cache.add) as mock_add:
            maybe_trigger_drain(webhook.mailbox_name)

        # The trigger releases the lock before returning. Sizing its TTL for a delivery
        # would strand the mailbox that long whenever a dispatcher dies mid-claim.
        assert mock_add.call_args.kwargs["timeout"] == DRAIN_LOCK_TTL

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel")
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
    def test_trigger_respects_held_lock(
        self, mock_drain: MagicMock, mock_drain_parallel: MagicMock
    ) -> None:
        # Another dispatcher is mid-claim and holds the lock; this trigger must
        # not dispatch over it.
        webhook = self.create_webhook_payload(mailbox_name="github:123", cell_name="us")
        cache.add(f"wh:drain_active:{webhook.mailbox_name}", 1, timeout=15)

        maybe_trigger_drain(webhook.mailbox_name)

        mock_drain.delay.assert_not_called()
        mock_drain_parallel.delay.assert_not_called()

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    @override_options(PUSH_TRIGGER_OPTIONS)
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
