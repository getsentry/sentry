from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.serializers.data_condition_handler_serializer import (
    DataConditionHandlerResponse,
    DataConditionHandlerSerializer,
)
from sentry.workflow_engine.models.data_condition import LEGACY_CONDITIONS, Condition
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler

SEER_ACTIVITY_INCOMPATIBLE_CONDITIONS: list[str] = [
    Condition.EVENT_ATTRIBUTE.value,
    Condition.TAGGED_EVENT.value,
    Condition.LEVEL.value,
    Condition.LATEST_RELEASE.value,
    Condition.LATEST_ADOPTED_RELEASE.value,
    Condition.EVENT_FREQUENCY_COUNT.value,
    Condition.EVENT_FREQUENCY_PERCENT.value,
    Condition.EVENT_UNIQUE_USER_FREQUENCY_COUNT.value,
    Condition.EVENT_UNIQUE_USER_FREQUENCY_PERCENT.value,
    Condition.PERCENT_SESSIONS_COUNT.value,
    Condition.PERCENT_SESSIONS_PERCENT.value,
]


def _get_incompatible_conditions() -> dict[str, list[str]]:
    return {
        Condition.SEER_ACTIVITY_TRIGGER.value: SEER_ACTIVITY_INCOMPATIBLE_CONDITIONS,
    }


@cell_silo_endpoint
class OrganizationDataConditionIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Fetch Data Conditions",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            201: inline_sentry_response_serializer(
                "ListDataConditionHandlerResponse", list[DataConditionHandlerResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization
    ) -> Response[list[DataConditionHandlerResponse]]:
        """
        Returns a list of data conditions for a given org
        """
        group = request.GET.get("group")
        try:
            DataConditionHandler.Group(group or "")
        except ValueError:
            raise serializers.ValidationError(
                f"Please provide a valid group. Accepted values are: {', '.join([group.value for group in DataConditionHandler.Group])}"
            )

        incompatible_conditions_map = _get_incompatible_conditions()
        data_conditions = []

        for condition_type, handler in condition_handler_registry.registrations.items():
            if condition_type not in LEGACY_CONDITIONS and handler.group == group:
                incompatible_conditions = incompatible_conditions_map.get(condition_type, [])
                serialized = serialize(
                    handler,
                    request.user,
                    DataConditionHandlerSerializer(),
                    condition_type=condition_type,
                    incompatible_conditions=incompatible_conditions,
                )
                data_conditions.append(serialized)

        return self.paginate(
            request=request,
            queryset=data_conditions,
            paginator_cls=OffsetPaginator,
        )
