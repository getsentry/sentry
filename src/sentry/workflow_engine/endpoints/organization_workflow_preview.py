from datetime import datetime, timedelta
from typing import Any, TypedDict

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers.rest_framework import CamelSnakeSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.organization_workflow_index import (
    OrganizationWorkflowPermission,
)
from sentry.workflow_engine.endpoints.validators.base.data_condition import (
    BaseDataConditionValidator,
)
from sentry.workflow_engine.endpoints.validators.base.data_condition_group import (
    BaseDataConditionGroupValidator,
)
from sentry.workflow_engine.models import DataConditionGroup
from sentry.workflow_engine.models.data_condition import Condition, get_condition_handler
from sentry.workflow_engine.preview import (
    InvalidPreviewConfiguration,
    PreviewCondition,
    PreviewConditionGroup,
)
from sentry.workflow_engine.processors.preview import (
    build_alert_preview_plan,
)
from sentry.workflow_engine.types import (
    ActionFilterDataConditionHandler,
    WorkflowTriggerDataConditionHandler,
)

FEATURE_FLAG = "organizations:workflow-alert-previews"


class WorkflowPreviewConfigValidator(CamelSnakeSerializer[Any]):
    frequency = serializers.IntegerField(required=False, min_value=0, default=0)


class WorkflowPreviewDataConditionValidator(BaseDataConditionValidator):
    condition_result = serializers.JSONField(required=False)


class WorkflowPreviewDataConditionGroupValidator(BaseDataConditionGroupValidator):
    def validate_conditions(self, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        conditions = []
        for condition in value:
            condition_validator = WorkflowPreviewDataConditionValidator(
                data=condition, context=self.context
            )
            condition_validator.is_valid(raise_exception=True)
            conditions.append(condition_validator.validated_data)

        return conditions


class WorkflowPreviewValidator(CamelSnakeSerializer[Any]):
    project_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
    config = WorkflowPreviewConfigValidator(required=False, default=dict)
    triggers = WorkflowPreviewDataConditionGroupValidator()
    action_filters = WorkflowPreviewDataConditionGroupValidator(many=True, allow_empty=False)


class AlertPreviewResultResponse(TypedDict):
    groupId: str
    triggeredAt: datetime
    isThrottled: bool


class AlertPreviewResponse(TypedDict):
    results: list[AlertPreviewResultResponse]


def _to_workflow_trigger_preview_condition_group(
    data: dict[str, Any],
) -> PreviewConditionGroup[WorkflowTriggerDataConditionHandler]:
    conditions: list[PreviewCondition[WorkflowTriggerDataConditionHandler]] = []
    for condition in data.get("conditions", []):
        condition_type = Condition(condition["type"])
        handler = get_condition_handler(condition_type)
        if handler is None or not issubclass(handler, WorkflowTriggerDataConditionHandler):
            raise serializers.ValidationError(
                {"detail": f"{condition_type.value} is not a workflow trigger condition"}
            )
        conditions.append(
            PreviewCondition(
                type=condition_type,
                comparison=condition["comparison"],
                handler=handler,
            )
        )

    return PreviewConditionGroup(
        logic_type=DataConditionGroup.Type(data["logic_type"]),
        conditions=tuple(conditions),
    )


def _to_action_filter_preview_condition_group(
    data: dict[str, Any],
) -> PreviewConditionGroup[ActionFilterDataConditionHandler[Any]]:
    conditions: list[PreviewCondition[ActionFilterDataConditionHandler[Any]]] = []
    for condition in data.get("conditions", []):
        condition_type = Condition(condition["type"])
        handler = get_condition_handler(condition_type)
        if handler is None or not issubclass(handler, ActionFilterDataConditionHandler):
            raise serializers.ValidationError(
                {"detail": f"{condition_type.value} is not an action filter condition"}
            )
        conditions.append(
            PreviewCondition(
                type=condition_type,
                comparison=condition["comparison"],
                handler=handler,
            )
        )

    return PreviewConditionGroup(
        logic_type=DataConditionGroup.Type(data["logic_type"]),
        conditions=tuple(conditions),
    )


@cell_silo_endpoint
@extend_schema(tags=["Workflows"])
class OrganizationWorkflowPreviewEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES
    permission_classes = (OrganizationWorkflowPermission,)

    @extend_schema(
        operation_id="Preview an Organization Workflow",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=WorkflowPreviewValidator,
        responses={
            200: inline_sentry_response_serializer(
                "AlertPreviewResponse", list[AlertPreviewResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self, request: Request, organization: Organization
    ) -> Response[list[AlertPreviewResponse]]:
        if not features.has(FEATURE_FLAG, organization, actor=request.user):
            raise ResourceDoesNotExist

        serializer = WorkflowPreviewValidator(
            data=request.data,
            context={"organization": organization},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        projects = self.get_projects(
            request,
            organization,
            project_ids=set(data["project_ids"]),
        )
        project_ids = [project.id for project in projects]

        try:
            plan = build_alert_preview_plan(
                triggers=_to_workflow_trigger_preview_condition_group(data["triggers"]),
                action_filters=[
                    _to_action_filter_preview_condition_group(action_filter)
                    for action_filter in data["action_filters"]
                ],
            )
            previews = plan.execute(
                project_ids,
                timezone.now(),
                throttling_period=timedelta(minutes=data["config"]["frequency"]),
            )
        except InvalidPreviewConfiguration:
            raise serializers.ValidationError(
                {"detail": "This alert configuration cannot be previewed."}
            )

        response: list[AlertPreviewResponse] = [
            {
                "results": [
                    {
                        "groupId": str(result.group_id),
                        "triggeredAt": result.triggered_at,
                        "isThrottled": result.is_throttled,
                    }
                    for result in preview.results
                ]
            }
            for preview in previews
        ]
        return Response(response)
