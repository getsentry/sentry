import datetime
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Never

import orjson
import sentry_sdk
from django.db.models import Min, Subquery
from django.utils import timezone
from requests import Response
from requests.models import HTTPError
from rest_framework import status

from sentry import options
from sentry.exceptions import RestrictedIPAddress
from sentry.hybridcloud.models.webhookpayload import BACKOFF_INTERVAL, MAX_ATTEMPTS, WebhookPayload
from sentry.shared_integrations.exceptions import (
    ApiConflictError,
    ApiConnectionResetError,
    ApiError,
    ApiHostError,
    ApiTimeoutError,
)
from sentry.silo.base import SiloMode
from sentry.silo.client import RegionSiloClient, SiloClientError
from sentry.tasks.base import instrumented_task
from sentry.types.region import get_region_by_name
from sentry.utils import metrics

logger = logging.getLogger(__name__)

MAX_MAILBOX_DRAIN = 300
"""
The maximum number of records that will be updated when scheduling a mailbox

More messages than this could be delivered if delivery is fast. We also limit
the runtime of any drain_mailbox operation to BATCH_SCHEDULE_OFFSET so that
a deep backlog doesn't soak up a worker indefinetly, and that slow but not timeout
slow forwarding yields to other tasks
"""


BATCH_SCHEDULE_OFFSET = datetime.timedelta(minutes=BACKOFF_INTERVAL)
"""
The time that batches are scheduled into the future when work starts.
Spacing batches out helps minimize competitive races when delivery is slow
but not at the timeout threshold
"""

BATCH_SIZE = 1000
"""The number of mailboxes that will have messages scheduled each cycle"""


MAX_DELIVERY_AGE = datetime.timedelta(days=3)
"""
The maximum age of a webhook we'll attempt to deliver.
The older a webhook gets the less valuable it is as there are likely other
actions that have been made to the relevant resources.
"""


class DeliveryFailed(Exception):
    """
    Used to signal an expected delivery failure.
    """

    pass


@instrumented_task(
    name="sentry.hybridcloud.tasks.deliver_webhooks.schedule_webhook_delivery",
    queue="webhook.control",
    silo_mode=SiloMode.CONTROL,
)
def schedule_webhook_delivery(**kwargs: Never) -> None:
    """
    Find mailboxes that contain undelivered webhooks that were scheduled
    to be delivered now or in the past.

    Triggered frequently by celery beat.
    """
    # The double call to .values() ensures that the group by includes mailbox_nam
    # but only id_min is selected
    head_of_line = (
        WebhookPayload.objects.all()
        .values("mailbox_name")
        .annotate(id_min=Min("id"))
        .values("id_min")
    )
    # Get any heads that are scheduled to run
    scheduled_mailboxes = WebhookPayload.objects.filter(
        schedule_for__lte=timezone.now(),
        id__in=Subquery(head_of_line),
    ).values("id", "mailbox_name")

    metrics.distribution(
        "hybridcloud.schedule_webhook_delivery.mailbox_count", scheduled_mailboxes.count()
    )
    for record in scheduled_mailboxes[:BATCH_SIZE]:
        # Reschedule the records that we will attempt to deliver next.
        # We update schedule_for in an attempt to minimize races for potentially in-flight batches.
        mailbox_batch = (
            WebhookPayload.objects.filter(id__gte=record["id"], mailbox_name=record["mailbox_name"])
            .order_by("id")
            .values("id")[:MAX_MAILBOX_DRAIN]
        )
        updated_count = WebhookPayload.objects.filter(id__in=Subquery(mailbox_batch)).update(
            schedule_for=timezone.now() + BATCH_SCHEDULE_OFFSET
        )
        # If we have 1/5 or more in a mailbox we should process in parallel as we're likely behind.
        if updated_count >= int(MAX_MAILBOX_DRAIN / 5):
            drain_mailbox_parallel.delay(record["id"])
        else:
            drain_mailbox.delay(record["id"])


@instrumented_task(
    name="sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox",
    queue="webhook.control",
    silo_mode=SiloMode.CONTROL,
)
def drain_mailbox(payload_id: int) -> None:
    """
    Attempt deliver up to 50 webhooks from the mailbox that `id` is from.

    Messages will be delivered in order until one fails or 50 are delivered.
    Once messages have successfully been delivered or discarded, they are deleted.
    """
    try:
        payload = WebhookPayload.objects.get(id=payload_id)
    except WebhookPayload.DoesNotExist:
        # We could have hit a race condition. Since we've lost already return
        # and let the other process continue, or a future process.
        metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "race"})
        logger.info(
            "deliver_webhook.potential_race",
            extra={
                "id": payload_id,
            },
        )
        return

    delivered = 0
    deadline = timezone.now() + BATCH_SCHEDULE_OFFSET
    while True:
        # We have run until the end of our batch schedule delay. Break the loop so this worker can take another
        # task.
        if timezone.now() >= deadline:
            logger.info(
                "deliver_webhook.delivery_deadline",
                extra={
                    "mailbox_name": payload.mailbox_name,
                    "delivered": delivered,
                },
            )
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery", tags={"outcome": "delivery_deadline"}
            )
            break

        # Fetch records from the batch in slices of 100. This avoids reading
        # redundant data should we hit an error and should help keep query duration low.
        query = WebhookPayload.objects.filter(
            id__gte=payload.id, mailbox_name=payload.mailbox_name
        ).order_by("id")

        batch_count = 0
        for record in query[:100]:
            batch_count += 1
            try:
                deliver_message(record)
                delivered += 1
            except DeliveryFailed:
                metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "retry"})
                return

        # No more messages to deliver
        if batch_count < 1:
            logger.info(
                "deliver_webhook.delivery_complete",
                extra={
                    "mailbox_name": payload.mailbox_name,
                    "delivered": delivered,
                },
            )
            return


@instrumented_task(
    name="sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel",
    queue="webhook.control",
    silo_mode=SiloMode.CONTROL,
)
def drain_mailbox_parallel(payload_id: int) -> None:
    """
    Deliver messages from a mailbox in small parallel batches.

    Parallel delivery sacrifices strict ordering for increased throughput.
    Because of the sequential delivery in a mailbox we can't get higher throughput
    by scheduling batches in parallel.

    Messages will be delivered in small batches until one fails, the batch
    delay timeout is reached, or a message with a schedule_for greater than
    the current time is encountered. A message with a higher schedule_for value
    indicates that we have hit the start of another batch that has been scheduled.
    """
    try:
        payload = WebhookPayload.objects.get(id=payload_id)
    except WebhookPayload.DoesNotExist:
        # We could have hit a race condition. Since we've lost already return
        # and let the other process continue, or a future process.
        metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "race"})
        logger.info(
            "deliver_webhook_parallel.potential_race",
            extra={
                "id": payload_id,
            },
        )
        return

    # Remove batches payloads that have been backlogged for MAX_DELIVERY_AGE.
    # Once payloads are this old they are low value, and we're better off prioritizing new work.
    max_age = timezone.now() - MAX_DELIVERY_AGE
    if payload.date_added < max_age:
        # We delete chunks of stale messages using a subquery
        # because postgres cannot do delete with limit
        stale_query = WebhookPayload.objects.filter(
            id__gte=payload.id,
            mailbox_name=payload.mailbox_name,
            date_added__lte=timezone.now() - MAX_DELIVERY_AGE,
        ).values("id")[:10000]
        deleted, _ = WebhookPayload.objects.filter(id__in=stale_query).delete()
        if deleted:
            logger.info(
                "deliver_webhook_parallel.max_age_discard",
                extra={
                    "mailbox_name": payload.mailbox_name,
                    "deleted": deleted,
                },
            )
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery", amount=deleted, tags={"outcome": "max_age"}
            )

    worker_threads = options.get("hybridcloud.webhookpayload.worker_threads")
    deadline = timezone.now() + BATCH_SCHEDULE_OFFSET
    request_failed = False
    delivered = 0
    while True:
        current_time = timezone.now()
        # We have run until the end of our batch schedule delay. Break the loop so this worker can take another
        # task.
        if current_time >= deadline:
            logger.info(
                "deliver_webhook_parallel.delivery_deadline",
                extra={
                    "mailbox_name": payload.mailbox_name,
                    "delivered": delivered,
                },
            )
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery", tags={"outcome": "delivery_deadline"}
            )
            break

        # Fetch records from the batch in batch_size blocks. This avoids reading
        # redundant data should we hit an error and should help keep query duration low.
        query = WebhookPayload.objects.filter(
            id__gte=payload.id, mailbox_name=payload.mailbox_name
        ).order_by("id")

        # Use a threadpool to send requests concurrently
        with ThreadPoolExecutor(max_workers=worker_threads) as threadpool:
            futures = {
                threadpool.submit(deliver_message_parallel, record)
                for record in query[:worker_threads]
            }
            for future in as_completed(futures):
                payload_record, err = future.result()

                if err:
                    # Was this the final attempt? Failing on a final attempt shouldn't stop
                    # deliveries as we won't retry
                    if payload_record.attempts >= MAX_ATTEMPTS:
                        payload_record.delete()

                        metrics.incr(
                            "hybridcloud.deliver_webhooks.delivery",
                            tags={"outcome": "attempts_exceed"},
                        )
                        logger.info(
                            "deliver_webhook_parallel.discard",
                            extra={"id": payload_record.id, "attempts": payload_record.attempts},
                        )
                    else:
                        metrics.incr(
                            "hybridcloud.deliver_webhooks.delivery", tags={"outcome": "retry"}
                        )
                        payload_record.schedule_next_attempt()
                        request_failed = True
                    if not isinstance(err, DeliveryFailed):
                        raise err
                else:
                    # Delivery was successful
                    payload_record.delete()
                    delivered += 1
                    duration = timezone.now() - payload_record.date_added
                    metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "ok"})
                    metrics.timing(
                        "hybridcloud.deliver_webhooks.delivery_time", duration.total_seconds()
                    )

            # We didn't have any more messages to deliver.
            # Break out of this task so we can get a new one.
            if len(futures) < 1:
                logger.info(
                    "deliver_webhook_parallel.task_complete",
                    extra={
                        "mailbox_name": payload.mailbox_name,
                        "delivered": delivered,
                    },
                )
                break

        # If a delivery failed we should stop processing this mailbox and try again later.
        if request_failed:
            logger.info(
                "deliver_webhook_parallel.delivery_request_failed",
                extra={
                    "mailbox_name": payload.mailbox_name,
                    "delivered": delivered,
                },
            )
            return


def deliver_message_parallel(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
    try:
        perform_request(payload)
        return (payload, None)
    except Exception as err:
        return (payload, err)


def deliver_message(payload: WebhookPayload) -> None:
    """Deliver a message if it still has delivery attempts remaining"""
    if payload.attempts >= MAX_ATTEMPTS:
        payload.delete()

        metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "attempts_exceed"})
        logger.info(
            "deliver_webhook.discard", extra={"id": payload.id, "attempts": payload.attempts}
        )
        return

    payload.schedule_next_attempt()
    perform_request(payload)
    payload.delete()

    duration = timezone.now() - payload.date_added
    metrics.timing("hybridcloud.deliver_webhooks.delivery_time", duration.total_seconds())
    metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "ok"})


def perform_request(payload: WebhookPayload) -> None:
    logging_context: dict[str, str | int] = {
        "payload_id": payload.id,
        "mailbox_name": payload.mailbox_name,
        "attempt": payload.attempts,
    }
    region = get_region_by_name(name=payload.region_name)

    try:
        client = RegionSiloClient(region=region)
        with metrics.timer(
            "hybridcloud.deliver_webhooks.send_request",
            tags={"destination_region": region.name},
        ):
            logging_context["region"] = region.name
            logging_context["request_method"] = payload.request_method
            logging_context["request_path"] = payload.request_path

            headers = orjson.loads(payload.request_headers)
            response = client.request(
                method=payload.request_method,
                path=payload.request_path,
                headers=headers,
                # We need to send the body as raw bytes to avoid interfering with webhook signatures
                data=payload.request_body.encode("utf-8"),
                json=False,
            )
        logger.info(
            "deliver_webhooks.success",
            extra={
                "status": getattr(
                    response, "status_code", 204
                ),  # Request returns empty dict instead of a response object when the code is a 204
                **logging_context,
            },
        )
    except ApiHostError as err:
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={"reason": "host_error", "destination_region": region.name},
        )
        with sentry_sdk.isolation_scope() as scope:
            scope.set_context(
                "region",
                {
                    "name": region.name,
                    "id": region.category,
                    "address": region.address,
                },
            )
            err_cause = err.__cause__
            if err_cause is not None and isinstance(err_cause, RestrictedIPAddress):
                # Region silos that are IP address restricted are actionable.
                silo_client_err = SiloClientError("Region silo is IP address restricted")
                silo_client_err.__cause__ = err
                sentry_sdk.capture_exception(silo_client_err)
                raise DeliveryFailed()

            sentry_sdk.capture_exception(err)
        logger.warning("deliver_webhooks.host_error", extra={"error": str(err), **logging_context})
        raise DeliveryFailed() from err
    except ApiConflictError as err:
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={"reason": "conflict", "destination_region": region.name},
        )
        logger.warning(
            "deliver_webhooks.conflict_occurred",
            extra={"conflict_text": err.text, **logging_context},
        )
        # We don't retry conflicts as those are explicit failure code to drop webhook.
    except (ApiTimeoutError, ApiConnectionResetError) as err:
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={"reason": "timeout_reset", "destination_region": region.name},
        )
        logger.warning("deliver_webhooks.timeout_error", extra=logging_context)
        raise DeliveryFailed() from err
    except ApiError as err:
        err_cause = err.__cause__
        response_code = -1
        if isinstance(err_cause, HTTPError):
            orig_response: Response | None = err_cause.response
            if orig_response is not None:
                response_code = orig_response.status_code

            # We need to retry on region 500s
            if status.HTTP_500_INTERNAL_SERVER_ERROR <= response_code < 600:
                raise DeliveryFailed() from err

            # We don't retry 404 or 400 as they will fail again.
            if response_code in {400, 401, 403, 404}:
                reason = "not_found"
                if response_code == 400:
                    reason = "bad_request"
                elif response_code == 401:
                    reason = "unauthorized"
                elif response_code == 403:
                    reason = "forbidden"
                metrics.incr(
                    "hybridcloud.deliver_webhooks.failure",
                    tags={"reason": reason, "destination_region": region.name},
                )
                logger.info(
                    "deliver_webhooks.40x_error",
                    extra={"reason": reason, **logging_context},
                )
                return

        # Other ApiErrors should be retried
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={"reason": "api_error", "destination_region": region.name},
        )
        logger.warning(
            "deliver_webhooks.api_error",
            extra={"error": str(err), "response_code": response_code, **logging_context},
        )
        raise DeliveryFailed() from err
