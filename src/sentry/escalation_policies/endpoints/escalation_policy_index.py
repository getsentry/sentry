from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.escalation_policy_examples import EscalationPolicyExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.escalation_policies.endpoints.serializers.escalation_policy import (
    EscalationPolicyPutSerializer,
    EscalationPolicySerializer,
    EscalationPolicySerializerResponse,
)
from sentry.escalation_policies.models.escalation_policy import EscalationPolicy


@extend_schema(tags=["Escalation Policies"])
@region_silo_endpoint
class OrganizationEscalationPolicyIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationPermission,)

    @extend_schema(
        operation_id="List an Organization's Escalation Policies",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListEscalationPolicies", list[EscalationPolicySerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EscalationPolicyExamples.LIST_ESCALATION_POLICIES,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Return a list of escalation policies bound to an organization.
        """
        queryset = EscalationPolicy.objects.filter(
            organization_id=organization.id,
        )
        serializer = EscalationPolicySerializer()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=("id",),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, serializer=serializer),
        )

    @extend_schema(
        operation_id="Create or update an Escalation Policy for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=EscalationPolicyPutSerializer,
        responses={
            200: EscalationPolicySerializerResponse,
            201: EscalationPolicySerializerResponse,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EscalationPolicyExamples.CREATE_OR_UPDATE_ESCALATION_POLICY,
    )
    def put(self, request: Request, organization) -> Response:
        """
        Create or update an escalation policy for the given organization.
        """
        serializer = EscalationPolicyPutSerializer(
            context={
                "organization": organization,
                "access": request.access,
                "user": request.user,
                "ip_address": request.META.get("REMOTE_ADDR"),
            },
            data=request.data,
        )

        if not serializer.is_valid():
            raise ValidationError(serializer.errors)

        # TODO: Check permissions -- if a policy with passed in ID is found, policy must be part of this org
        # TODO: assert organization_id is added properly

        policy = serializer.save()
        if "id" in request.data:
            return Response(serialize(policy, request.user), status=status.HTTP_200_OK)
        else:
            return Response(serialize(policy, request.user), status=status.HTTP_201_CREATED)
