from typing import Any, Dict

from sentry.issues.grouptype import ReplaySlowClickType
from sentry.replays.usecases.ingest.events import SentryEvent
from sentry.replays.usecases.issue import new_issue_occurrence


def report_slow_click_issue(project_id: int, event: SentryEvent) -> None:
    payload = event["data"]["payload"]

    # Only timeout reasons on <a> and <button> tags are accepted.
    if payload["data"]["node"]["tagName"] not in ("a", "button"):
        return None
    elif payload["data"]["endReason"] != "timeout":
        return None

    _report_sentry_slow_click_issue(
        fingerprint=payload["message"],
        project_id=project_id,
        subtitle=payload["message"],
        timestamp=int(payload["timestamp"]),
    )


def _report_sentry_slow_click_issue(
    fingerprint: str,
    project_id: int,
    subtitle: str,
    timestamp: int,
) -> None:
    """Temporary measure.

    We don't have all of the metadata yet so we're going to emulate while we experiment. This
    is a simple wrapper around "new_slow_click_issue".
    """
    _report_slow_click_issue(
        fingerprint=fingerprint,
        project_id=project_id,
        timestamp=timestamp,
        release="",
        environment="prod",
        subtitle=subtitle,
        extra_event_data={
            "user": {
                "id": "1",
                "username": "Test User",
                "email": "test.user@sentry.io",
            }
        },
    )


def _report_slow_click_issue(
    environment: str,
    fingerprint: str,
    project_id: int,
    release: str,
    subtitle: str,
    timestamp: int,
    extra_event_data: Dict[str, Any],
) -> None:
    """Produce a new slow click issue occurence to Kafka."""
    new_issue_occurrence(
        environment=environment,
        fingerprint=fingerprint,
        issue_type=ReplaySlowClickType.type_id,
        platform="javascript",
        project_id=project_id,
        release=release,
        subtitle=subtitle,
        timestamp=timestamp,
        title="[TEST] Slow Click Detected",
        **extra_event_data,
    )
