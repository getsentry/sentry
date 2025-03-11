from __future__ import annotations

import logging
from datetime import timedelta
from uuid import uuid4

from django.utils import timezone
from sentry_kafka_schemas.schema_types.uptime_configs_v1 import CheckConfig

from sentry.snuba.models import QuerySubscription
from sentry.tasks.base import instrumented_task
from sentry.uptime.config_producer import produce_config, produce_config_removal
from sentry.uptime.models import (
    UptimeRegionScheduleMode,
    UptimeSubscription,
    UptimeSubscriptionRegion,
)
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

    # May happen if a uptime subscription was created and then immediately disabled
    if subscription.status != UptimeSubscription.Status.CREATING.value:
        metrics.incr("uptime.subscriptions.create.incorrect_status", sample_rate=1.0)
        return

    for region in subscription.regions.all():
        send_uptime_subscription_config(region, subscription)
    subscription.update(
        status=QuerySubscription.Status.ACTIVE.value,
        subscription_id=subscription.subscription_id,
    )


@instrumented_task(
    name="sentry.uptime.subscriptions.tasks.update_remote_uptime_subscription",
    queue="uptime",
    default_retry_delay=5,
    max_retries=5,
)
def update_remote_uptime_subscription(uptime_subscription_id, **kwargs):
    """
    Pushes details of an uptime subscription to uptime subscription regions.
    """
    try:
        subscription = UptimeSubscription.objects.get(id=uptime_subscription_id)
    except UptimeSubscription.DoesNotExist:
        metrics.incr("uptime.subscriptions.update.subscription_does_not_exist", sample_rate=1.0)
        return
    if subscription.status != UptimeSubscription.Status.UPDATING.value:
        metrics.incr("uptime.subscriptions.update.incorrect_status", sample_rate=1.0)
        return

    for region in subscription.regions.all():
        send_uptime_subscription_config(region, subscription)
    subscription.update(
        status=QuerySubscription.Status.ACTIVE.value,
        subscription_id=subscription.subscription_id,
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

    region_slugs = [s.region_slug for s in subscription.regions.all()]

    subscription_id = subscription.subscription_id
    if subscription.status == QuerySubscription.Status.DELETING.value:
        subscription.delete()
    else:
        subscription.update(subscription_id=None)

    if subscription_id is not None:
        for region_slug in region_slugs:
            send_uptime_config_deletion(region_slug, subscription_id)


def send_uptime_subscription_config(
    region: UptimeSubscriptionRegion, subscription: UptimeSubscription
):
    if subscription.subscription_id is None:
        subscription.subscription_id = uuid4().hex
    produce_config(
        region.region_slug,
        uptime_subscription_to_check_config(
            subscription,
            subscription.subscription_id,
            UptimeSubscriptionRegion.RegionMode(region.mode),
        ),
    )


def uptime_subscription_to_check_config(
    subscription: UptimeSubscription,
    subscription_id: str,
    region_mode: UptimeSubscriptionRegion.RegionMode,
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
        "trace_sampling": subscription.trace_sampling,
        "active_regions": [r.region_slug for r in subscription.regions.filter(mode=region_mode)],
        "region_schedule_mode": UptimeRegionScheduleMode.ROUND_ROBIN.value,
    }
    if subscription.body is not None:
        config["request_body"] = subscription.body
    return config


def send_uptime_config_deletion(destination_region_slug: str, subscription_id: str) -> None:
    produce_config_removal(destination_region_slug, subscription_id)


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
            UptimeSubscription.Status.UPDATING.value,
            UptimeSubscription.Status.DELETING.value,
        ),
        date_updated__lt=timezone.now() - SUBSCRIPTION_STATUS_MAX_AGE,
    ):
        count += 1
        if subscription.status == UptimeSubscription.Status.CREATING.value:
            create_remote_uptime_subscription.delay(uptime_subscription_id=subscription.id)
        elif subscription.status == UptimeSubscription.Status.UPDATING.value:
            update_remote_uptime_subscription.delay(uptime_subscription_id=subscription.id)
        elif subscription.status == UptimeSubscription.Status.DELETING.value:
            delete_remote_uptime_subscription.delay(uptime_subscription_id=subscription.id)

    metrics.incr("uptime.subscriptions.repair", amount=count, sample_rate=1.0)
