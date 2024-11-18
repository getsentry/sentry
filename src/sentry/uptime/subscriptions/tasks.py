from __future__ import annotations

import logging
from datetime import timedelta
from uuid import uuid4

from django.utils import timezone
from sentry_kafka_schemas.schema_types.uptime_configs_v1 import CheckConfig

from sentry.snuba.models import QuerySubscription
from sentry.tasks.base import instrumented_task
from sentry.uptime.config_producer import produce_config, produce_config_removal
from sentry.uptime.models import UptimeSubscription
from sentry.utils import metrics

logger = logging.getLogger(__name__)


SUBSCRIPTION_STATUS_MAX_AGE = timedelta(minutes=10)


@instrumented_task(
    name="sentry.uptime.subscriptions.tasks.create_uptime_subscription",
    queue="uptime",
    default_retry_delay=5,
    max_retries=5,
)
def create_remote_uptime_subscription(uptime_subscription_id, **kwargs):
    try:
        subscription = UptimeSubscription.objects.get(id=uptime_subscription_id)
    except UptimeSubscription.DoesNotExist:
        metrics.incr("uptime.subscriptions.create.subscription_does_not_exist", sample_rate=1.0)
        return
    if subscription.status != UptimeSubscription.Status.CREATING.value:
        metrics.incr("uptime.subscriptions.create.incorrect_status", sample_rate=1.0)
        return

    subscription_id = send_uptime_subscription_config(subscription)
    # TODO: Ideally this should actually be `PENDING_FIRST_UPDATE` so we can validate it's really working as expected
    subscription.update(
        status=QuerySubscription.Status.ACTIVE.value, subscription_id=subscription_id
    )


@instrumented_task(
    name="sentry.uptime.subscriptions.tasks.delete_uptime_subscription",
    queue="uptime",
    default_retry_delay=5,
    max_retries=5,
)
def delete_remote_uptime_subscription(uptime_subscription_id, **kwargs):
    try:
        subscription = UptimeSubscription.objects.get(id=uptime_subscription_id)
    except UptimeSubscription.DoesNotExist:
        metrics.incr("uptime.subscriptions.delete.subscription_does_not_exist", sample_rate=1.0)
        return

    if subscription.status not in [
        UptimeSubscription.Status.DELETING.value,
        UptimeSubscription.Status.DISABLED.value,
    ]:
        metrics.incr("uptime.subscriptions.delete.incorrect_status", sample_rate=1.0)
        return

    subscription_id = subscription.subscription_id
    if subscription.status == QuerySubscription.Status.DELETING.value:
        subscription.delete()
    else:
        subscription.update(subscription_id=None)

    if subscription_id is not None:
        send_uptime_config_deletion(subscription_id)


def send_uptime_subscription_config(subscription: UptimeSubscription) -> str:
    # Whenever we create/update a config we always want to generate a new subscription id. This allows us to validate
    # that the config took effect
    subscription_id = uuid4().hex
    produce_config(uptime_subscription_to_check_config(subscription, subscription_id))
    return subscription_id


def uptime_subscription_to_check_config(
    subscription: UptimeSubscription, subscription_id: str
) -> CheckConfig:
    headers = subscription.headers
    # XXX: Temporary translation code. We want to support headers with the same keys, so convert to a list
    if isinstance(headers, dict):
        headers = [[key, val] for key, val in headers.items()]

    config: CheckConfig = {
        "subscription_id": subscription_id,
        "url": subscription.url,
        "interval_seconds": subscription.interval_seconds,
        "timeout_ms": subscription.timeout_ms,
        "request_method": subscription.method,
        "request_headers": headers,
    }
    if subscription.body is not None:
        config["request_body"] = subscription.body
    return config


def send_uptime_config_deletion(subscription_id: str) -> None:
    produce_config_removal(subscription_id)


@instrumented_task(
    name="sentry.uptime.tasks.subscription_checker",
    queue="uptime",
)
def subscription_checker(**kwargs):
    """
    Checks for subscriptions stuck in a transition status and attempts to repair them. This
    typically happens when we had some kind of error running the task the first time around.
    Usually network or configuration related.
    """
    count = 0
    for subscription in UptimeSubscription.objects.filter(
        status__in=(
            UptimeSubscription.Status.CREATING.value,
            UptimeSubscription.Status.DELETING.value,
        ),
        date_updated__lt=timezone.now() - SUBSCRIPTION_STATUS_MAX_AGE,
    ):
        count += 1
        if subscription.status == UptimeSubscription.Status.CREATING.value:
            create_remote_uptime_subscription.delay(uptime_subscription_id=subscription.id)
        elif subscription.status == UptimeSubscription.Status.DELETING.value:
            delete_remote_uptime_subscription.delay(uptime_subscription_id=subscription.id)

    metrics.incr("uptime.subscriptions.repair", amount=count, sample_rate=1.0)
