import random

import sentry_sdk

from sentry import features
from sentry.models.organization import Organization
from sentry.utils import metrics

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

    # only 30% of the alerts should have the nudge blocks
    if random.random() >= 0.3:
        record_nudge_metric("skipped_random_check")
        return False

    # The "sent" metric is emitted at render time
    return True
