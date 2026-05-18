"""
Debug-only endpoint for posting IssueActionLog events.

NOT a production API. In production, events are recorded by internal code paths
(e.g., post-process hooks, integration callbacks) that call record() directly.
This endpoint exists solely for development and testing — it allows posting
arbitrary events via HTTP to exercise the recording and processing pipeline
without wiring up real event sources.

Events should only come from trusted sources. There is no rate limiting,
no audit trail, and no validation beyond basic schema checks.
"""

from __future__ import annotations

from typing import Any

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.issues.derived.recording import record
from sentry.issues.derived.types import (
    AutofixPrCreatedAction,
    CommentAction,
    FetchAction,
    IssueAction,
    ResolvedInPullRequestAction,
    SetAssignedAction,
    SetResolvedAction,
    SetUnassignedAction,
    SetUnresolvedAction,
    ViewAction,
)
from sentry.models.group import Group
from sentry.models.organization import Organization

ACTION_CLASSES: dict[str, type[IssueAction]] = {
    "view": ViewAction,
    "comment": CommentAction,
    "fetch": FetchAction,
    "set_resolved": SetResolvedAction,
    "set_unresolved": SetUnresolvedAction,
    "set_assigned": SetAssignedAction,
    "set_unassigned": SetUnassignedAction,
    "autofix_pr_created": AutofixPrCreatedAction,
    "resolved_in_pull_request": ResolvedInPullRequestAction,
}


class EventSerializer(serializers.Serializer[None]):
    action = serializers.CharField()
    group_id = serializers.IntegerField()
    user_id = serializers.IntegerField(required=False, allow_null=True, default=None)
    action_data = serializers.DictField(child=serializers.JSONField(), required=False, default=dict)


class BatchSerializer(serializers.Serializer[None]):
    events = EventSerializer(many=True, allow_empty=False)


@cell_silo_endpoint
class OrganizationIssueActionLogDebugEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, organization: Organization) -> Response:
        serializer = BatchSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        events = serializer.validated_data["events"]

        # Validate all events before recording any.
        parsed: list[tuple[Group, IssueAction, int | None]] = []
        errors: list[dict[str, Any]] = []

        # Fetch groups and validate they belong to this org.
        group_ids = {e["group_id"] for e in events}
        groups_by_id = {
            g.id: g
            for g in Group.objects.filter(
                id__in=group_ids,
                project__organization_id=organization.id,
            )
        }

        for i, event in enumerate(events):
            action_name = event["action"]
            if action_name not in ACTION_CLASSES:
                errors.append({"index": i, "detail": f"Unknown action: {action_name!r}"})
                continue

            group = groups_by_id.get(event["group_id"])
            if group is None:
                errors.append({"index": i, "detail": "Group not found in this organization"})
                continue

            action_cls = ACTION_CLASSES[action_name]
            try:
                action = action_cls(**event["action_data"])
            except Exception as e:
                errors.append({"index": i, "detail": str(e)})
                continue

            parsed.append((group, action, event["user_id"]))

        if errors:
            return Response({"detail": errors}, status=status.HTTP_400_BAD_REQUEST)

        for group, action, user_id in parsed:
            record(group_id=group.id, project_id=group.project_id, action=action, user_id=user_id)

        return Response({"recorded": len(parsed)}, status=status.HTTP_201_CREATED)
