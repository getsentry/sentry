from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectAlertRulePermission, ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse, GroupSerializer
from sentry.api.serializers.rest_framework.rule import RulePreviewSerializer
from sentry.models.group import Group
from sentry.models.groupinbox import InboxDetails, get_inbox_details
from sentry.rules.history.preview import preview


@region_silo_endpoint
class ProjectRulePreviewEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    permission_classes = (ProjectAlertRulePermission,)

    # a post endpoint because it's too hard to pass a list of objects from the frontend
    def post(self, request: Request, project) -> Response:
        """
        Get a list of alert triggers in past 2 weeks for given rules

            {method} {path}
            {{
                "conditions": [],
                "filters": [],
                "actionMatch": "all",
                "filterMatch": "all",
                "frequency": 60,
                "endpoint": datetime or None
            }}

        """
        serializer = RulePreviewSerializer(
            context={"project": project, "organization": project.organization}, data=request.data
        )

        if not serializer.is_valid():
            raise ValidationError

        data = serializer.validated_data
        if data.get("endpoint") is None:
            data["endpoint"] = timezone.now()
        group_fires = preview(
            project,
            data.get("conditions", []),
            data.get("filters", []),
            data.get("actionMatch"),
            data.get("filterMatch"),
            data.get("frequency"),
            data.get("endpoint"),
        )

        if group_fires is None:
            raise ValidationError

        fired_groups = Group.objects.filter(id__in=group_fires.keys()).order_by("-id")

        response = self.paginate(
            request=request,
            queryset=fired_groups,
            order_by="-id",
            count_hits=True,
        )

        response.data = serialize(
            response.data,
            request.user,
            PreviewSerializer(),
            inbox_details=get_inbox_details(response.data),
            group_fires=group_fires,
        )

        response["Endpoint"] = data["endpoint"]
        return response


class _PreviewResponse(BaseGroupSerializerResponse):
    inbox: InboxDetails
    lastTriggered: int


class PreviewSerializer(GroupSerializer):
    def serialize(
        self, obj: Group, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> _PreviewResponse:
        result = super().serialize(obj, attrs, user, **kwargs)
        group_id = int(result["id"])
        return {
            **result,
            "inbox": kwargs["inbox_details"].get(group_id),
            "lastTriggered": kwargs["group_fires"][group_id],
        }
