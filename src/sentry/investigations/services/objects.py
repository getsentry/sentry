from __future__ import annotations

from collections.abc import Set as AbstractSet
from dataclasses import dataclass
from typing import Any

from sentry.eventstore import backend as eventstore
from sentry.investigations.services.investigations import (
    InvestigationSourceNotFound,
    resolve_investigation_source,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project


@dataclass(frozen=True)
class ResolvedInvestigationObject:
    project_id: int
    value: dict[str, Any]


def resolve_investigation_object(
    *,
    organization: Organization,
    reference: dict[str, Any],
    accessible_project_ids: AbstractSet[int],
) -> ResolvedInvestigationObject:
    object_type = reference["type"]
    ref = reference["ref"]
    if object_type == "metric_open_period":
        resolved = resolve_investigation_source(
            organization=organization,
            source=reference,
            accessible_project_ids=accessible_project_ids,
        )
        return ResolvedInvestigationObject(resolved.project_id, resolved.source)
    if object_type == "issue":
        group = (
            Group.objects.filter(
                id=ref["groupId"],
                project__organization=organization,
                project_id__in=accessible_project_ids,
            )
            .select_related("project")
            .first()
        )
        if group is None:
            raise InvestigationSourceNotFound
        return ResolvedInvestigationObject(
            group.project_id,
            {
                "type": "issue",
                "ref": {"groupId": str(group.id)},
                "snapshot": {
                    "groupId": str(group.id),
                    "projectId": str(group.project_id),
                    "projectSlug": group.project.slug,
                    "title": group.title,
                    "culprit": group.culprit,
                    "platform": group.platform,
                    "firstSeen": group.first_seen.isoformat() if group.first_seen else None,
                    "lastSeen": group.last_seen.isoformat() if group.last_seen else None,
                    "count": group.times_seen,
                },
            },
        )
    if object_type == "event":
        project = Project.objects.filter(
            id=ref["projectId"], organization=organization, id__in=accessible_project_ids
        ).first()
        if project is None:
            raise InvestigationSourceNotFound
        event = eventstore.get_event_by_id(project.id, ref["eventId"].lower())
        if event is None:
            raise InvestigationSourceNotFound
        return ResolvedInvestigationObject(
            project.id,
            {
                "type": "event",
                "ref": {"projectId": str(project.id), "eventId": event.event_id},
                "snapshot": {
                    "eventId": event.event_id,
                    "projectId": str(project.id),
                    "projectSlug": project.slug,
                    "groupId": str(event.group_id) if event.group_id else None,
                    "timestamp": event.datetime.isoformat(),
                    "title": event.title,
                    "platform": event.platform,
                    "environment": event.data.get("environment"),
                    "release": event.data.get("release"),
                    "transaction": event.data.get("transaction"),
                    "exception": event.data.get("exception"),
                    "stacktrace": event.data.get("stacktrace"),
                    "trace": event.data.get("contexts", {}).get("trace"),
                    "tags": event.data.get("tags", []),
                },
            },
        )
    raise InvestigationSourceNotFound
