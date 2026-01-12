from datetime import timedelta
from unittest.mock import MagicMock, PropertyMock, patch

import pytest
import responses
from django.test import override_settings
from django.utils import timezone
from requests.exceptions import ConnectionError, ReadTimeout

from sentry import options
from sentry.hybridcloud.models.webhookpayload import MAX_ATTEMPTS, DestinationType, WebhookPayload
from sentry.hybridcloud.tasks import deliver_webhooks
from sentry.hybridcloud.tasks.deliver_webhooks import (
    MAX_MAILBOX_DRAIN,
    drain_mailbox,
    drain_mailbox_parallel,
    schedule_webhook_delivery,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.options import override_options
from sentry.testutils.region import override_regions
from sentry.testutils.silo import control_silo_test
from sentry.types.region import Region, RegionCategory, RegionResolutionError

region_config = [Region("us", 1, "http://us.testserver", RegionCategory.MULTI_TENANT)]


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
            region_name="us",
        )
        webhook_two = self.create_webhook_payload(
            mailbox_name="github:256",
            region_name="us",
        )
        assert webhook_one.schedule_for < timezone.now()
        assert webhook_two.schedule_for < timezone.now()

        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 2

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_one_mailbox_multiple_messages(self, mock_deliver: MagicMock) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 1
        mock_deliver.delay.assert_called_with(webhook_one.id)

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_mailbox_scheduled_later(self, mock_deliver: MagicMock) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        self.create_webhook_payload(
            mailbox_name="github:256",
            region_name="us",
            schedule_for=timezone.now() + timedelta(minutes=1),
        )
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 1
        mock_deliver.delay.assert_called_with(webhook_one.id)

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_updates_mailbox_attributes(self, mock_deliver: MagicMock) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        webhook_two = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
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
        mock_deliver.delay.assert_called_with(webhook_one.id)

    @responses.activate
    @override_regions(region_config)
    def test_schedule_mailbox_with_more_than_batch_size_records(self) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", body=ReadTimeout()
        )
        num_records = 55
        for _ in range(0, num_records):
            self.create_webhook_payload(
                mailbox_name="github:123",
                region_name="us",
            )
        # Run the task that is spawned to provide some integration test coverage.
        with self.tasks():
            schedule_webhook_delivery()

        # First attempt will fail rescheduling messages.
        assert len(responses.calls) == 1
        assert WebhookPayload.objects.count() == num_records
        head = WebhookPayload.objects.all().order_by("id").first()
        assert head
        assert head.schedule_for > timezone.now()

        # Do another scheduled run. This should not make any forwarding requests
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
                region_name="us",
            )
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 1

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
            region_name="us",
        )
        github_webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            provider="github",
            region_name="us",
        )
        stripe_webhook = self.create_webhook_payload(
            mailbox_name="stripe:123",
            provider="stripe",
            region_name="us",
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
            region_name="us",
        )
        stripe_webhook = self.create_webhook_payload(
            mailbox_name="stripe:123",
            provider="stripe",
            region_name="us",
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
            region_name="us",
            request_method="POST",
            request_path="/webhook/",
            request_headers="{}",
            request_body="{}",
        )

        # Create webhook with stripe provider
        stripe_webhook = self.create_webhook_payload(
            mailbox_name="stripe:123",
            provider="stripe",
            region_name="us",
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

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_handles_invalid_constraint_records(self, mock_deliver: MagicMock) -> None:
        """Test that webhooks violating CHECK constraint are deleted and don't block scheduling."""
        # Create a valid webhook
        valid_webhook = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )

        # Create an invalid webhook that violates the CHECK constraint
        # (destination_type='sentry_region' but region_name=NULL)
        # We need to bypass the model's validation by using raw SQL
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO hybridcloud_webhookpayload
                (mailbox_name, provider, destination_type, region_name, request_method,
                 request_path, request_headers, request_body, schedule_for, attempts, date_added)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [
                    "github:123",
                    "github",
                    "sentry_region",
                    None,  # This violates the CHECK constraint
                    "POST",
                    "/webhook/",
                    "{}",
                    "{}",
                    timezone.now() - timedelta(minutes=5),
                    0,
                    timezone.now(),
                ],
            )
            invalid_id = cursor.fetchone()[0]

        # Verify both records exist
        assert WebhookPayload.objects.count() == 2

        # Run the scheduler - should delete invalid record and schedule valid one
        schedule_webhook_delivery()

        # Verify invalid record was deleted
        assert not WebhookPayload.objects.filter(id=invalid_id).exists()
        # Verify valid record still exists and was scheduled
        assert WebhookPayload.objects.filter(id=valid_webhook.id).exists()
        # Verify drain_mailbox was called for the valid webhook
        assert mock_deliver.delay.call_count == 1
        mock_deliver.delay.assert_called_with(valid_webhook.id)


def create_payloads(num: int, mailbox: str) -> list[WebhookPayload]:
    created = []
    for _ in range(0, num):
        hook = Factories.create_webhook_payload(
            mailbox_name=mailbox,
            region_name="us",
        )
        created.append(hook)
    return created


def create_payloads_with_destination_type(
    num: int, mailbox: str, destination_type: DestinationType
) -> list[WebhookPayload]:
    created = []
    for _ in range(0, num):
        hook = Factories.create_webhook_payload(
            mailbox_name=mailbox,
            region_name=None,
            destination_type=destination_type,
        )
        created.append(hook)
    return created


@control_silo_test
class DrainMailboxTest(TestCase):
    @responses.activate
    def test_drain_missing_payload(self) -> None:
        drain_mailbox(99)
        assert len(responses.calls) == 0

    @responses.activate
    def test_drain_unknown_region(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="lolnope",
        )
        with pytest.raises(RegionResolutionError):
            drain_mailbox(webhook_one.id)
        assert len(responses.calls) == 0

    @responses.activate
    @override_regions(region_config)
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
        records = create_payloads(5, "github:123")
        drain_mailbox(records[0].id)

        # Attempts should stop as soon as the first delivery
        # fails. This retains mailbox ordering while yielding this
        # worker for new work
        assert len(responses.calls) == 2

        # Mailbox should have 4 records left
        assert WebhookPayload.objects.count() == 4

        # Remaining record should be scheduled to run later.
        first = WebhookPayload.objects.order_by("id").first()
        assert first
        assert first.attempts == 1
        assert first.schedule_for > timezone.now()

    @responses.activate
    @override_regions(region_config)
    def test_drain_success(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        records = create_payloads(3, "github:123")
        drain_mailbox(records[0].id)

        # Mailbox should be empty
        assert not WebhookPayload.objects.filter().exists()

    @responses.activate
    @override_settings(CODECOV_API_BASE_URL="https://api.codecov.io")
    @override_options(
        {
            "codecov.api-bridge-signing-secret": "test",
        }
    )
    @override_regions(region_config)
    def test_drain_success_codecov(self) -> None:
        responses.add(
            responses.POST,
            "https://api.codecov.io/webhooks/sentry",
            status=200,
            body="",
        )

        records = create_payloads_with_destination_type(
            3, "github:codecov:123", DestinationType.CODECOV
        )
        drain_mailbox(records[0].id)

        # Mailbox should be empty
        assert not WebhookPayload.objects.filter().exists()

    @responses.activate
    @override_settings(CODECOV_API_BASE_URL=None)
    @override_regions(region_config)
    def test_drain_codecov_configuration_error(self) -> None:
        responses.add(
            responses.POST,
            "https://api.codecov.io/webhooks/sentry",
            status=200,
            body="",
        )

        records = create_payloads_with_destination_type(
            3, "github:codecov:123", DestinationType.CODECOV
        )
        drain_mailbox(records[0].id)

        # We don't retry codecov requests no matter what
        hook = WebhookPayload.objects.filter().first()
        assert hook is None
        assert len(responses.calls) == 0

    @responses.activate
    @override_settings(CODECOV_API_BASE_URL="https://api.codecov.io")
    @override_options(
        {
            "codecov.api-bridge-signing-secret": "test",
        }
    )
    @override_regions(region_config)
    def test_drain_codecov_request_error(self) -> None:
        responses.add(
            responses.POST,
            "https://api.codecov.io/webhooks/sentry",
            status=400,
            body="",
        )

        records = create_payloads_with_destination_type(
            3, "github:codecov:123", DestinationType.CODECOV
        )
        drain_mailbox(records[0].id)

        # We don't retry codecov requests no matter what
        hook = WebhookPayload.objects.filter().first()
        assert hook is None
        assert len(responses.calls) == 3

    @responses.activate
    @override_regions(region_config)
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
            drain_mailbox(records[0].id)

        # Once start time + batch offset is in the past we stop delivery
        assert WebhookPayload.objects.count() == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_too_many_attempts(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
            attempts=MAX_ATTEMPTS,
        )
        drain_mailbox(webhook_one.id)
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 0

    @responses.activate
    @override_regions(region_config)
    def test_drain_more_than_max_attempts(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
            attempts=MAX_ATTEMPTS + 1,
        )
        drain_mailbox(webhook_one.id)
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 0

    @responses.activate
    @override_regions(region_config)
    def test_drain_fatality(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            # While this specific scenario won't happen, the client libraries could fail
            body=ValueError(),
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        with pytest.raises(ValueError):
            drain_mailbox(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert hook.attempts == 1
        assert hook.schedule_for >= timezone.now()
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_host_error(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            body=ConnectionError(),
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        drain_mailbox(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
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
            region_name="us",
        )
        drain_mailbox(webhook_one.id)
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_api_error_unauthorized(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=401,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        drain_mailbox(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        # We don't retry 401
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_api_error_bad_request(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=400,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        drain_mailbox(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        # We don't retry 400
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_api_error_forbidden(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=403,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        drain_mailbox(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        # We don't retry 403
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_not_found(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/plugins/github/organizations/123/webhook/",
            status=404,
            body="<html><title>lol nope</title></html>",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="plugins:123",
            region_name="us",
            request_path="/plugins/github/organizations/123/webhook/",
        )
        drain_mailbox(webhook_one.id)

        # We don't retry if the region 404s
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_timeout(self) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", body=ReadTimeout()
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        drain_mailbox(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert hook.schedule_for > timezone.now()
        assert hook.attempts == 1

        assert len(responses.calls) == 1


@control_silo_test
class DrainMailboxParallelTest(TestCase):
    @responses.activate
    def test_drain_missing_payload(self) -> None:
        drain_mailbox_parallel(99)
        assert len(responses.calls) == 0

    @responses.activate
    def test_drain_unknown_region(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="lolnope",
        )
        with pytest.raises(RegionResolutionError):
            drain_mailbox_parallel(webhook_one.id)
        assert len(responses.calls) == 0

    @responses.activate
    @override_regions(region_config)
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
        records = create_payloads(5, "github:123")
        drain_mailbox_parallel(records[0].id)

        worker_threads = options.get("hybridcloud.webhookpayload.worker_threads")
        # We'll attempt one thread batch, but the second+ will fail
        assert len(responses.calls) == worker_threads

        # Mailbox should have 4 records left
        assert WebhookPayload.objects.count() == 4

        # Remaining record should be scheduled to run later.
        first = WebhookPayload.objects.order_by("id").first()
        assert first
        assert first.attempts == 1
        assert first.schedule_for > timezone.now()

    @responses.activate
    @override_regions(region_config)
    def test_drain_success(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=200,
            body="",
        )
        records = create_payloads(3, "github:123")
        drain_mailbox_parallel(records[0].id)

        # Mailbox should be empty
        assert not WebhookPayload.objects.filter().exists()

    @responses.activate
    @override_regions(region_config)
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
            drain_mailbox_parallel(records[0].id)

        # Once start time + batch offset is in the past we stop delivery
        assert WebhookPayload.objects.count() == 1

    @responses.activate
    @override_regions(region_config)
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

        drain_mailbox_parallel(records[0].id)

        # Mailbox should be empty
        assert not WebhookPayload.objects.filter().exists()
        # No requests sent because records are too old
        assert len(responses.calls) == 0

    @responses.activate
    @override_regions(region_config)
    def test_drain_too_many_attempts(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=500,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
            attempts=MAX_ATTEMPTS,
        )
        drain_mailbox_parallel(webhook_one.id)
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_more_than_max_attempts(self) -> None:
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
            attempts=MAX_ATTEMPTS + 1,
        )
        drain_mailbox_parallel(webhook_one.id)
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_fatality(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            # While this specific scenario won't happen, the client libraries could fail
            body=ValueError(),
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        with pytest.raises(ValueError):
            drain_mailbox_parallel(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert hook.attempts == 1
        assert hook.schedule_for >= timezone.now()
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_host_error(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            body=ConnectionError(),
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        drain_mailbox_parallel(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
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
            region_name="us",
        )
        drain_mailbox_parallel(webhook_one.id)
        assert not WebhookPayload.objects.filter(id=webhook_one.id).exists()
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_api_error_unauthorized(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=401,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        drain_mailbox_parallel(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        # We don't retry 401
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_api_error_bad_request(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/extensions/github/webhook/",
            status=400,
            body="",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        drain_mailbox_parallel(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        # We don't retry 400
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_not_found(self) -> None:
        responses.add(
            responses.POST,
            "http://us.testserver/plugins/github/organizations/123/webhook/",
            status=404,
            body="<html><title>lol nope</title></html>",
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="plugins:123",
            region_name="us",
            request_path="/plugins/github/organizations/123/webhook/",
        )
        drain_mailbox_parallel(webhook_one.id)

        # We don't retry if the region 404s
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook is None
        assert len(responses.calls) == 1

    @responses.activate
    @override_regions(region_config)
    def test_drain_timeout(self) -> None:
        responses.add(
            responses.POST, "http://us.testserver/extensions/github/webhook/", body=ReadTimeout()
        )
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="us",
        )
        drain_mailbox_parallel(webhook_one.id)
        hook = WebhookPayload.objects.filter(id=webhook_one.id).first()
        assert hook
        assert hook.schedule_for > timezone.now()
        assert hook.attempts == 1

        assert len(responses.calls) == 1
