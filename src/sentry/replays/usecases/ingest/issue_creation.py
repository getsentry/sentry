import datetime
import logging
from typing import Any
from uuid import UUID

from sentry.constants import MAX_CULPRIT_LENGTH
from sentry.issues.grouptype import ReplayHydrationErrorType, ReplayRageClickType
from sentry.issues.issue_occurrence import IssueEvidence
from sentry.replays.usecases.issue import new_issue_occurrence
from sentry.utils import metrics

logger = logging.getLogger()

HYDRATION_ERROR_TITLE = "Hydration Error"
HYDRATION_ERROR_SUBTITLE = "Hydration failed - the server rendered HTML didn't match the client."
HYDRATION_ERROR_LEVEL = "error"
HYDRATION_ERROR_FINGERPRINT = "1"  # all hydration errors in a project will be grouped together
RAGE_CLICK_TITLE = "Rage Click"
RAGE_CLICK_LEVEL = "error"


def report_hydration_error_issue_with_replay_event(
    project_id: int,
    replay_id: str,
    timestamp: float,
    url: str | None,
    replay_event: dict[str, Any],
):
    metrics.incr("replay.hydration_error_issue_creation_with_replay_event")

    # Seconds since epoch is UTC.
    date = datetime.datetime.fromtimestamp(timestamp)
    timestamp_utc = date.replace(tzinfo=datetime.UTC)

    new_issue_occurrence(
        culprit=url[:MAX_CULPRIT_LENGTH] if url else "",
        environment=replay_event.get(
            "environment", "production"
        ),  # if no environment is set, default to production
        fingerprint=[HYDRATION_ERROR_FINGERPRINT],
        issue_type=ReplayHydrationErrorType,
        level=HYDRATION_ERROR_LEVEL,
        platform=replay_event["platform"],
        project_id=project_id,
        subtitle=HYDRATION_ERROR_SUBTITLE,
        timestamp=timestamp_utc,
        title=HYDRATION_ERROR_TITLE,
        extra_event_data={
            "contexts": _make_contexts(replay_id, replay_event),
            "level": HYDRATION_ERROR_LEVEL,
            "tags": _make_tags(replay_id, url, replay_event),
            "user": replay_event.get("user"),
            "release": replay_event.get("release"),
            "sdk": replay_event.get("sdk"),
            "dist": replay_event.get("dist"),
        },
    )


def report_rage_click_issue_with_replay_event(
    project_id: int,
    replay_id: str,
    timestamp: float,
    selector: str,
    url: str,
    node: dict[str, Any],
    component_name: str | None,
    replay_event: dict[str, Any],
):
    metrics.incr("replay.rage_click_issue_creation_with_replay_event")

    # Seconds since epoch is UTC.
    date = datetime.datetime.fromtimestamp(timestamp)
    timestamp_utc = date.replace(tzinfo=datetime.UTC)

    selector = selector
    clicked_element = _make_clicked_element(node)
    component_name = component_name
    evidence = [
        IssueEvidence(name="Clicked Element", value=clicked_element, important=False),
    ]
    evidence_data = {
        # RRWeb node data of clicked element.
        "node": node,
        # CSS selector path to clicked element.
        "selector": selector,
    }

    if component_name:
        # component name is important
        evidence.extend(
            [
                IssueEvidence(name="Selector Path", value=selector, important=False),
                IssueEvidence(name="React Component Name", value=component_name, important=True),
            ],
        )
        evidence_data.update({"component_name": component_name})
    else:
        # selector path is important
        evidence.append(
            IssueEvidence(name="Selector Path", value=selector, important=True),
        )

    new_issue_occurrence(
        culprit=url[:MAX_CULPRIT_LENGTH],
        environment=replay_event.get(
            "environment", "production"
        ),  # if no environment is set, default to production
        fingerprint=[selector],
        issue_type=ReplayRageClickType,
        level=RAGE_CLICK_LEVEL,
        platform=replay_event["platform"],
        project_id=project_id,
        subtitle=selector,
        timestamp=timestamp_utc,
        title=RAGE_CLICK_TITLE,
        evidence_data=evidence_data,
        evidence_display=evidence,
        extra_event_data={
            "contexts": _make_contexts(replay_id, replay_event),
            "level": RAGE_CLICK_LEVEL,
            "tags": _make_tags(replay_id, url, replay_event),
            "user": replay_event.get("user"),
            "release": replay_event.get("release"),
            "sdk": replay_event.get("sdk"),
            "dist": replay_event.get("dist"),
        },
    )


def _make_contexts(replay_id, replay_event):
    contexts = {"replay": {"replay_id": replay_id}}

    if replay_event.get("trace_ids"):
        if len(replay_event["trace_ids"]) > 0:
            trace_id = replay_event["trace_ids"][0]
            trace_id_hex = UUID(trace_id).hex
            # there could in theory be multiple traces, but generally
            # lets just use the first one. can adjust if this is not ideal
            trace_context = {"trace_id": trace_id_hex}
            contexts.update({"trace": trace_context})

    if replay_event.get("contexts"):
        contexts.update(replay_event["contexts"])

    return contexts


def _make_tags(replay_id, url, replay_event):
    tags = {"replayId": replay_id, "url": url}
    if replay_event.get("tags"):
        tags.update(replay_event["tags"])

    return tags


def _make_clicked_element(node):
    element = node.get("tagName", "")
    if "attributes" in node:
        for key, value in node["attributes"].items():
            value = value.strip()
            if key == "id":
                element += f"#{value}"
            elif key == "class":
                element = element + "." + ".".join(value.split(" "))
            elif key == "role":
                element += f'[role="{value}"]'
            elif key == "alt":
                element += f'[alt="{value}"]'
            elif key == "data-test-id" or key == "data-testid":
                element += f'[data-test-id="{value}"]'
            elif key == "aria-label":
                element += f'[aria="{value}"]'
            elif key == "title":
                element += f'[title="{value}"]'
            elif key == "data-sentry-component":
                element += f'[data-sentry-component="{value}"]'

    return element
