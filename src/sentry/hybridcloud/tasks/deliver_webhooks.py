import datetime
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import orjson
import requests
import sentry_sdk
from django.db.models import Case, CharField, Min, Subquery, Value, When
from django.utils import timezone
from requests import Response
from requests.models import HTTPError
from rest_framework import status

from sentry import options
from sentry.codecov.client import CodecovApiClient, ConfigurationError
from sentry.exceptions import RestrictedIPAddress
from sentry.hybridcloud.models.webhookpayload import (
    BACKOFF_INTERVAL,
    MAX_ATTEMPTS,
    DestinationType,
    WebhookPayload,
)
from sentry.shared_integrations.exceptions import (
    ApiConflictError,
    ApiConnectionResetError,
    ApiError,
    ApiHostError,
    ApiTimeoutError,
)
from sentry.silo.base import SiloMode
from sentry.silo.client import RegionSiloClient, SiloClientError
from sentry.silo.util import clean_proxy_headers
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import hybridcloud_control_tasks
from sentry.types.region import Region, get_region_by_name
from sentry.utils import metrics

logger = logging.getLogger(__name__)

SLOW_DELIVERY_THRESHOLD = datetime.timedelta(minutes=10)
"""Duration threshold for logging slow webhook deliveries."""

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

# Define priorities for different webhook providers
# Lower number means higher priority
PROVIDER_PRIORITY = {
    "stripe": 1,
}
# Default priority for providers not explicitly listed above
DEFAULT_PROVIDER_PRIORITY = 10


def _set_webhook_delivery_sentry_context(payload: WebhookPayload) -> None:
    """Set Sentry context at webhook delivery entrypoint for easier debugging."""
    sentry_sdk.set_tag("mailbox_name", payload.mailbox_name)
    context: dict[str, str] = {
        "mailbox_name": payload.mailbox_name,
        "provider": payload.provider or "unknown",
    }
    sentry_sdk.set_context("webhook_delivery", context)


class DeliveryFailed(Exception):
    """
    Used to signal an expected delivery failure.
    """

    pass


@instrumented_task(
    name="sentry.hybridcloud.tasks.deliver_webhooks.schedule_webhook_delivery",
    namespace=hybridcloud_control_tasks,
    processing_deadline_duration=30,
    silo_mode=SiloMode.CONTROL,
)
def schedule_webhook_delivery() -> None:
    """
    Find mailboxes that contain undelivered webhooks that were scheduled
    to be delivered now or in the past.

    Prioritizes webhooks based on provider importance.

    Triggered frequently by task-scheduler.
    """
    # Se use the replica for any read queries to webhook payload
    WebhookPayloadReplica = WebhookPayload.objects.using_replica()

    # The double call to .values() ensures that the group by includes mailbox_name
    # but only id_min is selected
    head_of_line = (
        WebhookPayloadReplica.all()
        .values("mailbox_name")
        .annotate(id_min=Min("id"))
        .values("id_min")
    )

    # Get any heads that are scheduled to run
    # Use provider field directly, with default priority for null values
    scheduled_mailboxes = (
        WebhookPayloadReplica.filter(
            schedule_for__lte=timezone.now(),
            id__in=Subquery(head_of_line),
        )
        # Set priority value based on provider field
        .annotate(
            provider_priority=Case(
                # For providers that match our priority list
                *[
                    When(provider=provider, then=Value(priority))
                    for provider, priority in PROVIDER_PRIORITY.items()
                ],
                # Default value for all other cases (including null providers)
                default=Value(DEFAULT_PROVIDER_PRIORITY),
                output_field=CharField(),
            )
        )
        # Order by priority first (lowest number = highest priority), then ID
        .order_by("provider_priority", "id")
        .values("id", "mailbox_name")
    )

    metrics.distribution(
        "hybridcloud.schedule_webhook_delivery.mailbox_count", scheduled_mailboxes.count()
    )

    for record in scheduled_mailboxes[:BATCH_SIZE]:
        # Reschedule the records that we will attempt to deliver next.
        # We update schedule_for in an attempt to minimize races for potentially in-flight batches.
        mailbox_batch = (
            WebhookPayloadReplica.filter(id__gte=record["id"], mailbox_name=record["mailbox_name"])
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
    namespace=hybridcloud_control_tasks,
    processing_deadline_duration=300,
    silo_mode=SiloMode.CONTROL,
)
def drain_mailbox(payload_id: int) -> None:
    """
    Attempt deliver up to 50 webhooks from the mailbox that `id` is from.

    Messages will be delivered in order until one fails or 50 are delivered.
    Once messages have successfully been delivered or discarded, they are deleted.
    """
    WebhookPayloadReplica = WebhookPayload.objects.using_replica()

    try:
        payload = WebhookPayloadReplica.get(id=payload_id)
    except WebhookPayload.DoesNotExist:
        # We could have hit a race condition. Since we've lost already return
        # and let the other process continue, or a future process.
        metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "race"})
        logger.info("deliver_webhook.potential_race", extra={"id": payload_id})
        return

    _set_webhook_delivery_sentry_context(payload)

    delivered = 0
    deadline = timezone.now() + BATCH_SCHEDULE_OFFSET
    while True:
        # We have run until the end of our batch schedule delay. Break the loop so this worker can take another
        # task.
        if timezone.now() >= deadline:
            logger.info(
                "deliver_webhook.delivery_deadline",
                extra={
                    **payload.as_dict(),
                    "delivered": delivered,
                },
            )
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery", tags={"outcome": "delivery_deadline"}
            )
            break

        # Fetch records from the batch in slices of 100. This avoids reading
        # redundant data should we hit an error and should help keep query duration low.
        query = WebhookPayloadReplica.filter(
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
            logger.debug(
                "deliver_webhook.delivery_complete",
                extra={
                    **payload.as_dict(),
                    "delivered": delivered,
                },
            )
            return


def _discard_stale_mailbox_payloads(payload: WebhookPayload) -> None:
    """
    Remove payloads in this mailbox that are older than MAX_DELIVERY_AGE.
    Once payloads are this old they are low value, and we're better off prioritizing new work.
    """
    with sentry_sdk.start_span(
        op="hybridcloud.deliver_webhooks.discard_stale_mailbox_payloads"
    ) as span:
        span.set_tag("mailbox_name", payload.mailbox_name)
        max_age = timezone.now() - MAX_DELIVERY_AGE
        if payload.date_added >= max_age:
            return
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
                    **payload.as_dict(),
                    "deleted": deleted,
                },
            )
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery", amount=deleted, tags={"outcome": "max_age"}
            )


def _record_delivery_time_metrics(payload: WebhookPayload) -> None:
    """Record delivery time metrics for a successfully delivered webhook payload."""
    exclude_mailboxes = set(
        options.get("hybridcloud.deliver_webhooks.delivery_time_exclude_mailboxes") or ()
    )
    if payload.mailbox_name in exclude_mailboxes:
        return
    duration = timezone.now() - payload.date_added
    region_sent_to = (
        payload.region_name
        if payload.destination_type == DestinationType.SENTRY_REGION
        else "codecov"
    )
    tags = {"region_sent_to": region_sent_to}
    metrics.distribution(
        "hybridcloud.deliver_webhooks.delivery_time_ms",
        # e.g. 0.123 seconds → 123 milliseconds
        duration.total_seconds() * 1000,
        tags=tags,
        unit="millisecond",
    )


def _handle_parallel_delivery_result(
    payload_record: WebhookPayload, err: Exception | None
) -> tuple[bool, bool]:
    """
    Process one result from the parallel delivery threadpool.
    Returns (request_failed, should_reraise).
    """
    payload_data = payload_record.as_dict()
    if err:
        if payload_record.attempts >= MAX_ATTEMPTS:
            payload_record.delete()
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery",
                tags={"outcome": "attempts_exceed"},
            )
            logger.info(
                "deliver_webhook_parallel.discard",
                extra={**payload_data},
            )
            request_failed = False
        else:
            metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "retry"})
            payload_record.schedule_next_attempt()
            request_failed = True
        return (request_failed, not isinstance(err, DeliveryFailed))
    date_added = payload_record.date_added
    payload_record.delete()
    _record_delivery_time_metrics(payload_record)
    metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "ok"})
    if timezone.now() - date_added >= SLOW_DELIVERY_THRESHOLD:
        logger.warning("deliver_webhook.slow_delivery", extra=payload_data)
    return (False, False)


def _run_parallel_delivery_batch(
    payload: WebhookPayload, worker_threads: int
) -> tuple[int, bool, bool]:
    """
    Run one batch of parallel deliveries for the mailbox.
    Returns (delivered_count, request_failed, no_more_messages).
    """
    query = WebhookPayload.objects.filter(
        id__gte=payload.id, mailbox_name=payload.mailbox_name
    ).order_by("id")

    with ThreadPoolExecutor(max_workers=worker_threads) as threadpool:
        futures = {
            threadpool.submit(deliver_message_parallel, record) for record in query[:worker_threads]
        }
        delivered = 0
        request_failed = False
        for future in as_completed(futures):
            payload_record, err = future.result()
            batch_request_failed, should_reraise = _handle_parallel_delivery_result(
                payload_record, err
            )
            request_failed = request_failed or batch_request_failed
            if should_reraise and err is not None:
                raise err
            if err is None:
                delivered += 1
        no_more_messages = len(futures) < 1
    return (delivered, request_failed, no_more_messages)


@instrumented_task(
    name="sentry.hybridcloud.tasks.deliver_webhooks.drain_mailbox_parallel",
    namespace=hybridcloud_control_tasks,
    # Give more time than the threadpool delivery deadline
    processing_deadline_duration=int(BATCH_SCHEDULE_OFFSET.total_seconds() + 10),
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
        logger.info("deliver_webhook_parallel.potential_race", extra={"id": payload_id})
        return

    _set_webhook_delivery_sentry_context(payload)
    _discard_stale_mailbox_payloads(payload)

    worker_threads = options.get("hybridcloud.webhookpayload.worker_threads")
    deadline = timezone.now() + BATCH_SCHEDULE_OFFSET
    delivered = 0
    extra = {**payload.as_dict(), "delivered": delivered}
    while True:
        if timezone.now() >= deadline:
            logger.info("deliver_webhook_parallel.delivery_deadline", extra=extra)
            metrics.incr(
                "hybridcloud.deliver_webhooks.delivery", tags={"outcome": "delivery_deadline"}
            )
            break

        delivered_batch, request_failed, no_more_messages = _run_parallel_delivery_batch(
            payload, worker_threads
        )
        delivered += delivered_batch
        extra["delivered"] = delivered

        if no_more_messages:
            logger.info("deliver_webhook_parallel.task_complete", extra=extra)
            break

        if request_failed:
            logger.info("deliver_webhook_parallel.delivery_request_failed", extra=extra)
            return


def deliver_message_parallel(payload: WebhookPayload) -> tuple[WebhookPayload, Exception | None]:
    try:
        perform_request(payload)
        return (payload, None)
    except Exception as err:
        return (payload, err)


def deliver_message(payload: WebhookPayload) -> None:
    """Deliver a message if it still has delivery attempts remaining"""
    payload_data = payload.as_dict()
    if payload.attempts >= MAX_ATTEMPTS:
        payload.delete()

        metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "attempts_exceed"})
        logger.info("deliver_webhook.discard", extra={**payload_data})
        return

    payload.schedule_next_attempt()
    perform_request(payload)
    date_added = payload.date_added
    payload.delete()
    _record_delivery_time_metrics(payload)
    if timezone.now() - date_added >= SLOW_DELIVERY_THRESHOLD:
        logger.warning("deliver_webhook.slow_delivery", extra=payload_data)
    metrics.incr("hybridcloud.deliver_webhooks.delivery", tags={"outcome": "ok"})


def perform_request(payload: WebhookPayload) -> None:
    destination_type = payload.destination_type

    match destination_type:
        case DestinationType.SENTRY_REGION:
            assert payload.region_name is not None
            region = get_region_by_name(name=payload.region_name)
            perform_region_request(region, payload)
        case DestinationType.CODECOV:
            perform_codecov_request(payload)


def perform_region_request(region: Region, payload: WebhookPayload) -> None:
    try:
        client = RegionSiloClient(region=region)
        with metrics.timer(
            "hybridcloud.deliver_webhooks.send_request",
            tags={"destination_region": region.name},
        ):
            headers = orjson.loads(payload.request_headers)
            response = client.request(
                method=payload.request_method,
                path=payload.request_path,
                headers=headers,
                # We need to send the body as raw bytes to avoid interfering with webhook signatures
                data=payload.request_body.encode("utf-8"),
                json=False,
            )
        logger.debug(
            "deliver_webhooks.success",
            extra={
                "status": getattr(
                    response, "status_code", 204
                ),  # Request returns empty dict instead of a response object when the code is a 204
                **payload.as_dict(),
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
        logger.warning(
            "deliver_webhooks.host_error", extra={"error": str(err), **payload.as_dict()}
        )
        raise DeliveryFailed() from err
    except ApiConflictError as err:
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={"reason": "conflict", "destination_region": region.name},
        )
        logger.warning(
            "deliver_webhooks.conflict_occurred",
            extra={"conflict_text": err.text, **payload.as_dict()},
        )
        # We don't retry conflicts as those are explicit failure code to drop webhook.
    except (ApiTimeoutError, ApiConnectionResetError) as err:
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={"reason": "timeout_reset", "destination_region": region.name},
        )
        logger.warning("deliver_webhooks.timeout_error", extra=payload.as_dict())
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
                    extra={"reason": reason, **payload.as_dict()},
                )
                return

        # Other ApiErrors should be retried
        metrics.incr(
            "hybridcloud.deliver_webhooks.failure",
            tags={"reason": "api_error", "destination_region": region.name},
        )
        logger.warning(
            "deliver_webhooks.api_error",
            extra={"error": str(err), "response_code": response_code, **payload.as_dict()},
        )
        raise DeliveryFailed() from err


def _should_skip_codecov_forward_for_github_owner(payload: WebhookPayload) -> bool:
    """
    Return True if this payload should be skipped (not forwarded to Codecov).
    The payload is still deleted by the caller when skipped.
    """
    skip_github_owners = options.get("codecov.forward-webhooks.skip-github-owners") or ()
    skip_set = (
        frozenset(str(x) for x in skip_github_owners if x) if skip_github_owners else frozenset()
    )
    if not skip_set:
        return False
    try:
        body = orjson.loads(payload.request_body)
    except orjson.JSONDecodeError:
        return False
    if not isinstance(body, dict):
        return False
    repository = body.get("repository") if isinstance(body.get("repository"), dict) else None
    owner = (
        repository.get("owner")
        if repository and isinstance(repository.get("owner"), dict)
        else None
    )
    login = owner.get("login") if owner else None
    if isinstance(login, str) and login in skip_set:
        metrics.incr("hybridcloud.deliver_webhooks.send_request_to_codecov.filtered")
        return True
    return False


def perform_codecov_request(payload: WebhookPayload) -> None:
    """
    We don't retry forwarding Codecov requests for now. We want to prove out that it would work.
    """
    with metrics.timer(
        "hybridcloud.deliver_webhooks.send_request_to_codecov",
    ):
        # transform request to match what codecov is expecting
        if payload.request_path.strip("/") != "extensions/github/webhook":
            metrics.incr(
                "hybridcloud.deliver_webhooks.send_request_to_codecov.unexpected_path",
            )
            logger.warning(
                "deliver_webhooks.send_request_to_codecov.unexpected_path",
                extra={"error": "unexpected path", **payload.as_dict()},
            )
            return

        if _should_skip_codecov_forward_for_github_owner(payload):
            return

        # hard coding this because the endpoint path is different from the original request
        endpoint = "/webhooks/sentry"

        try:
            client = CodecovApiClient()
        except ConfigurationError as err:
            metrics.incr(
                "hybridcloud.deliver_webhooks.send_request_to_codecov.configuration_error",
            )
            logger.warning(
                "deliver_webhooks.send_request_to_codecov.configuration_error",
                extra={"error": str(err), **payload.as_dict()},
            )
            return

        try:
            headers = orjson.loads(payload.request_headers)
        except orjson.JSONDecodeError as err:
            metrics.incr(
                "hybridcloud.deliver_webhooks.send_request_to_codecov.json_decode_error",
            )
            logger.warning(
                "deliver_webhooks.send_request_to_codecov.json_decode_error",
                extra={"error": str(err), **payload.as_dict()},
            )
            return

        try:
            response = client.post(
                endpoint=endpoint,
                data=payload.request_body,
                headers=clean_proxy_headers(headers),
            )

            if response.status_code != 200:
                metrics.incr(
                    "hybridcloud.deliver_webhooks.send_request_to_codecov.failure",
                )
                logger.warning(
                    "deliver_webhooks.send_request_to_codecov.failure",
                    extra={
                        "error": "unexpected status code",
                        "status_code": response.status_code,
                        **payload.as_dict(),
                    },
                )
                return
        except requests.exceptions.RequestException as err:
            metrics.incr(
                "hybridcloud.deliver_webhooks.send_request_to_codecov.failure",
            )
            logger.warning(
                "deliver_webhooks.send_request_to_codecov.failure",
                extra={"error": str(err), **payload.as_dict()},
            )
            return
