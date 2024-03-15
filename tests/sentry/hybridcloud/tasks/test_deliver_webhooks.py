from datetime import timedelta
from unittest.mock import PropertyMock, patch

import pytest
import responses
from django.utils import timezone
from requests.exceptions import ConnectionError, ReadTimeout

from sentry import options
from sentry.hybridcloud.models.webhookpayload import MAX_ATTEMPTS, WebhookPayload
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
    def test_schedule_no_records(self, mock_deliver):
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 0

    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox")
    def test_schedule_multiple_mailboxes(self, mock_deliver):
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
    def test_schedule_one_mailbox_multiple_messages(self, mock_deliver):
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
    def test_schedule_mailbox_scheduled_later(self, mock_deliver):
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
    def test_schedule_updates_mailbox_attributes(self, mock_deliver):
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
    def test_schedule_mailbox_with_more_than_batch_size_records(self):
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

    @override_options({"hybridcloud.webhookpayload.use_parallel": True})
    @patch("sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel")
    def test_schedule_mailbox_parallel_task(self, mock_deliver):
        for _ in range(0, MAX_MAILBOX_DRAIN + 1):
            self.create_webhook_payload(
                mailbox_name="github:123",
                region_name="us",
            )
        schedule_webhook_delivery()
        assert mock_deliver.delay.call_count == 1


def create_payloads(num: int, mailbox: str) -> list[WebhookPayload]:
    created = []
    for _ in range(0, num):
        hook = Factories.create_webhook_payload(
            mailbox_name=mailbox,
            region_name="us",
        )
        created.append(hook)
    return created


@control_silo_test
class DrainMailboxTest(TestCase):
    @responses.activate
    def test_drain_missing_payload(self):
        drain_mailbox(99)
        assert len(responses.calls) == 0

    @responses.activate
    def test_drain_unknown_region(self):
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="lolnope",
        )
        with pytest.raises(RegionResolutionError):
            drain_mailbox(webhook_one.id)
        assert len(responses.calls) == 0

    @responses.activate
    @override_regions(region_config)
    def test_drain_success_partial(self):
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
    def test_drain_success(self):
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
    @override_regions(region_config)
    def test_drain_time_limit(self):
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
    def test_drain_too_many_attempts(self):
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
    def test_drain_more_than_max_attempts(self):
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
    def test_drain_fatality(self):
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
    def test_drain_host_error(self):
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
    def test_drain_conflict(self):
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
    def test_drain_api_error_unauthorized(self):
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
    def test_drain_api_error_bad_request(self):
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
    def test_drain_not_found(self):
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
    def test_drain_timeout(self):
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
    def test_drain_missing_payload(self):
        drain_mailbox_parallel(99)
        assert len(responses.calls) == 0

    @responses.activate
    def test_drain_unknown_region(self):
        webhook_one = self.create_webhook_payload(
            mailbox_name="github:123",
            region_name="lolnope",
        )
        with pytest.raises(RegionResolutionError):
            drain_mailbox_parallel(webhook_one.id)
        assert len(responses.calls) == 0

    @responses.activate
    @override_regions(region_config)
    def test_drain_success_partial(self):
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
    def test_drain_success(self):
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
    def test_drain_time_limit(self):
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
    def test_drain_too_many_attempts(self):
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
    def test_drain_more_than_max_attempts(self):
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
    def test_drain_fatality(self):
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
    def test_drain_host_error(self):
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
    def test_drain_conflict(self):
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
    def test_drain_api_error_unauthorized(self):
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
    def test_drain_api_error_bad_request(self):
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
    def test_drain_not_found(self):
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
    def test_drain_timeout(self):
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
