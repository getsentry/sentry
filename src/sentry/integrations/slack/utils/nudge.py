import random
from datetime import datetime, timezone

import sentry_sdk

from sentry import features
from sentry.models.organization import Organization
from sentry.utils import metrics
from sentry.utils.cache import cache

SLACK_NUDGE_METRIC = "slack.alert_nudge"


def record_nudge_metric(result: str, nudge_type: str | None = None) -> None:
    """Emit the nudge metric to Datadog (via ``metrics``) and the Sentry metrics
    product (via the SDK) in one place, so both stay in sync."""
    tags = {"result": result}
    if nudge_type is not None:
        tags["nudge_type"] = nudge_type
    metrics.incr(SLACK_NUDGE_METRIC, sample_rate=1.0, tags=tags)
    sentry_sdk.metrics.count(SLACK_NUDGE_METRIC, 1, attributes=tags)


def should_send_nudge_block(
    *,
    channel_id: str,
    organization: Organization,
) -> bool:
    if not features.has("organizations:slack-reinstall-nudge-on-issue-alert", organization):
        return False

    # only 10% of the alerts should have the nudge blocks
    if random.random() >= 0.1:
        record_nudge_metric("skipped_random_check")
        return False

    iso_year, iso_week, _ = datetime.now(timezone.utc).isocalendar()
    cache_key = f"slack:alert_nudge:{channel_id}:{iso_year}:{iso_week}"

    count = cache.get(cache_key, 0)
    if count >= 4:
        record_nudge_metric("skipped_weekly_limit")
        return False

    if count == 0:
        cache.set(cache_key, 1, timeout=7 * 24 * 60 * 60)
    else:
        try:
            cache.incr(cache_key)
        except ValueError:
            # The key may have been evicted/expired between the get and the
            # incr; incr raises ValueError on a missing key, so fall back to set.
            cache.set(cache_key, count + 1, timeout=7 * 24 * 60 * 60)

    # The "sent" metric is emitted at render time
    return True
