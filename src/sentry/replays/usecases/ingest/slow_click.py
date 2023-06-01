import datetime
from typing import Any, Dict

from django.conf import settings

from sentry import options
from sentry.issues.grouptype import ReplaySlowClickType
from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.replays.usecases.issue import new_issue_occurrence


def report_slow_click_issue(
    org_id: int,
    project_id: int,
    replay_id: str,
    event: SentryEvent,
) -> bool:
    # TODO: Remove after GA.
    #
    # Only report slow clicks if the option is enabled.
    if not options.get("replay.issues.slow_click"):
        return False

    # TODO: Remove after GA.
    #
    # Check that the organization feature flag is enabled before proceeding.
    if org_id not in settings.SENTRY_REPLAYS_DEAD_CLICK_ISSUE_ALLOWLIST:
        return False

    payload = event["data"]["payload"]

    # Only timeout reasons on <a> and <button> tags are accepted.
    if payload["data"]["node"]["tagName"] not in ("a", "button"):
        return False
    elif payload["data"]["endReason"] != "timeout":
        return False

    # Seconds since epoch is UTC.
    timestamp = datetime.datetime.fromtimestamp(payload["timestamp"])
    timestamp = timestamp.replace(tzinfo=datetime.timezone.utc)

    _report_slow_click_issue(
        environment="prod",
        fingerprint=payload["message"],
        project_id=project_id,
        release="",
        subtitle=payload["message"],
        timestamp=timestamp,
        extra_event_data={
            "contexts": {"replay": {"replay_id": replay_id}},
            "level": "info",
            "tags": {"replayId": replay_id},
            "user": {
                "id": "1",
                "username": "Test User",
                "email": "test.user@sentry.io",
            },
        },
    )

    return True


def _report_slow_click_issue(
    environment: str,
    fingerprint: str,
    project_id: int,
    release: str,
    subtitle: str,
    timestamp: datetime.datetime,
    extra_event_data: Dict[str, Any],
) -> None:
    """Produce a new slow click issue occurence to Kafka."""
    new_issue_occurrence(
        environment=environment,
        fingerprint=fingerprint,
        issue_type=ReplaySlowClickType,
        platform="javascript",
        project_id=project_id,
        release=release,
        subtitle=subtitle,
        timestamp=timestamp,
        title="[TEST] Slow Click Detected",
        extra_event_data=extra_event_data,
    )
