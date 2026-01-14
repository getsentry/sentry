from drf_spectacular.utils import extend_schema
from rest_framework import serializers

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.workflow_engine_examples import WorkflowEngineExamples
from sentry.apidocs.parameters import DataConditionParams, GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.workflow_engine.endpoints.serializers.data_condition_handler_serializer import (
    DataConditionHandlerResponse,
    DataConditionHandlerSerializer,
)
from sentry.workflow_engine.models.data_condition import LEGACY_CONDITIONS
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler


@region_silo_endpoint
@extend_schema(tags=["Workflows"])
class OrganizationDataConditionIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Fetch Data Conditions",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            DataConditionParams.GROUP,
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
        examples=WorkflowEngineExamples.LIST_DATA_CONDITIONS,
    )
    def get(self, request, organization):
        """
        Returns a list of data conditions for a given organization
        """
        group = request.GET.get("group")
        try:
            DataConditionHandler.Group(group)
        except ValueError:
            raise serializers.ValidationError(
                f"Please provide a valid group. Accepted values are: {', '.join([group.value for group in DataConditionHandler.Group])}"
            )

        data_conditions = []

        for condition_type, handler in condition_handler_registry.registrations.items():
            if condition_type not in LEGACY_CONDITIONS and handler.group == group:
                serialized = serialize(
                    handler,
                    request.user,
                    DataConditionHandlerSerializer(),
                    condition_type=condition_type,
                )
                data_conditions.append(serialized)

        return self.paginate(
            request=request,
            queryset=data_conditions,
            paginator_cls=OffsetPaginator,
        )
