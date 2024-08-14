from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers.base import serialize
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import EscalationPolicyParams, GlobalParams
from sentry.escalation_policies.endpoints.serializers.escalation_policy import (
    EscalationPolicySerializer,
    EscalationPolicySerializerResponse,
)
from sentry.escalation_policies.models.escalation_policy import EscalationPolicy


@extend_schema(tags=["Escalation Policies"])
@region_silo_endpoint
class OrganizationEscalationPolicyDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationPermission,)

    def convert_args(self, request: Request, escalation_policy_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]

        try:
            kwargs["escalation_policy"] = EscalationPolicy.objects.get(
                organization=organization, id=escalation_policy_id
            )
        except EscalationPolicy.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    @extend_schema(
        operation_id="Get an escalation policy",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, EscalationPolicyParams.ESCALATION_POLICY_ID],
        request=None,
        responses={
            200: EscalationPolicySerializerResponse,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=None,  # TODO:
    )
    def get(self, request: Request, organization, escalation_policy) -> Response:
        """
        Return a single escalation policy
        """
        escalation_policy = EscalationPolicy.objects.get(
            organization_id=organization.id,
        )
        serializer = EscalationPolicySerializer()

        return Response(serialize(escalation_policy, serializer))

    @extend_schema(
        operation_id="Delete an Escalation Policy for an Organization",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, EscalationPolicyParams.ESCALATION_POLICY_ID],
        request=None,
        responses={
            204: None,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=None,  # TODO:
    )
    def delete(self, request: Request, organization, escalation_policy) -> Response:
        """
        Create or update an escalation policy for the given organization.
        """
        escalation_policy.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
