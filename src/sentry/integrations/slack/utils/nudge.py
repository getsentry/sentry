import sentry_sdk

from sentry import features
from sentry.models.organization import Organization
from sentry.options.rollout import in_random_rollout, in_rollout_group
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


def should_send_nudge_block(*, organization: Organization, notification_uuid: str | None) -> bool:
    """
    Sampling is keyed on `notification_uuid` when there is one, so every render of the same
    notification makes the same decision.
    """
    if not features.has("organizations:slack-reinstall-nudge-on-issue-alert", organization):
        return False

    # Configurable frequency of nudge blocks (default 0.3 = 30%)
    sampled = (
        in_rollout_group("slack.nudge-frequency", notification_uuid)
        if notification_uuid
        else in_random_rollout("slack.nudge-frequency")
    )
    if not sampled:
        record_nudge_metric("skipped_random_check")
        return False

    # The "sent" metric is emitted at render time
    return True
