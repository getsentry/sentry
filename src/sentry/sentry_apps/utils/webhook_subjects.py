from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from sentry.sentry_apps.utils.webhooks import SentryAppResourceType
from sentry.utils.safe import get_path


@dataclass(frozen=True)
class SubjectSpec:
    """
    Spec to extract subject id and type from the webhook payload.
    """

    # The resource type (e.g. Group, Event, autofix_run, etc.)
    subject_type: str
    # From the webhook payload, the key path to the subject's identifier
    paths: Sequence[Sequence[str]]

    def resolve(self, data: Mapping[str, Any]) -> tuple[str | None, str | None]:
        for path in self.paths:
            value = get_path(data, *path)
            if value is not None:
                return str(value), self.subject_type
        return None, None


# Default resource -> subject mapping. Adding a new resource here covers all of its event types.
# Ex SubjectSpec("installation", [("installation", "uuid")]) -> data.get("installation").get("uuid")
_SUBJECT_BY_RESOURCE: Mapping[SentryAppResourceType, SubjectSpec] = {
    SentryAppResourceType.ERROR: SubjectSpec("event", [("error", "event_id")]),
    SentryAppResourceType.EVENT_ALERT: SubjectSpec("event", [("event", "event_id")]),
    SentryAppResourceType.ISSUE: SubjectSpec("group", [("issue", "id")]),
    SentryAppResourceType.ACTIVITY_ALERT: SubjectSpec("group", [("issue", "id")]),
    SentryAppResourceType.COMMENT: SubjectSpec("comment", [("comment_id",)]),
    # TODO: AlertRule is a legacy model and should be migrated to Detector when we phase out the legacy payload
    SentryAppResourceType.METRIC_ALERT: SubjectSpec(
        "alert_rule", [("metric_alert", "alert_rule", "id")]
    ),
    SentryAppResourceType.INSTALLATION: SubjectSpec("installation", [("installation", "uuid")]),
    SentryAppResourceType.SEER: SubjectSpec("autofix_run", [("run_id",), ("sentry_run_id",)]),
    SentryAppResourceType.PREPROD_ARTIFACT: SubjectSpec("preprod_artifact", [("buildId",)]),
}

# Overrides for event types in case an event (seer.X) needs a diff. subject
_SUBJECT_BY_EVENT_TYPE: Mapping[str, SubjectSpec] = {}


def extract_webhook_subject(
    resource: SentryAppResourceType, event_type: str, data: Mapping[str, Any]
) -> tuple[str | None, str | None]:
    """
    Given the resource and event type, extract the subject id and type from the webhook payload(data).
    Attempts to resolve the event type override first, then the resource default.
    """
    spec = _SUBJECT_BY_EVENT_TYPE.get(event_type) or _SUBJECT_BY_RESOURCE.get(resource)
    if spec is None:
        return None, None
    return spec.resolve(data)
