from typing import NotRequired, TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.response import Response

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
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.workflow_engine.endpoints.serializers import DataConditionHandlerSerializer
from sentry.workflow_engine.models.data_condition import IGNORED_CONDITIONS
from sentry.workflow_engine.registry import condition_handler_registry
from sentry.workflow_engine.types import DataConditionHandler


class DataConditionRequestSerializer(serializers.Serializer):
    type = serializers.ChoiceField(
        choices=[type.value for type in DataConditionHandler.Type],
    )


class DataConditionHandlerResponse(TypedDict):
    condition_id: str
    type: str
    filter_group: NotRequired[str]
    comparison_json_schema: dict


@region_silo_endpoint
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
    def get(self, request, organization):
        """
        Returns a list of data conditions for a given org
        """
        serializer = DataConditionRequestSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serialized = serializer.validated_data

        type = serialized.get("type")

        data_conditions = []

        for condition, handler in condition_handler_registry.registrations.items():
            if condition not in IGNORED_CONDITIONS and handler.type == type:
                condition_json = {"condition_id": condition}

                condition_json.update(
                    serialize(handler, request.user, DataConditionHandlerSerializer())
                )
                data_conditions.append(condition_json)

        return self.paginate(
            request=request,
            queryset=data_conditions,
            paginator_cls=OffsetPaginator,
        )
