from __future__ import annotations

from drf_spectacular.utils import extend_schema
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
from sentry.escalation_policies import alter_escalation_policy_state
from sentry.escalation_policies.endpoints.serializers.escalation_policy import (
    EscalationPolicySerializerResponse,
)
from sentry.escalation_policies.endpoints.serializers.escalation_policy_state import (
    EscalationPolicyStatePutSerializer,
    EscalationPolicyStateSerializer,
)
from sentry.escalation_policies.models.escalation_policy_state import (
    EscalationPolicyState,
    EscalationPolicyStateType,
)


@extend_schema(tags=["Escalation Policies"])
@region_silo_endpoint
class OrganizationEscalationPolicyStateDetailsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "PUT": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationPermission,)

    def convert_args(self, request: Request, escalation_policy_state_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]

        try:
            kwargs["escalation_policy_state"] = EscalationPolicyState.objects.get(
                escalation_policy__organization=organization, id=escalation_policy_state_id
            )
        except EscalationPolicyState.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs

    @extend_schema(
        operation_id="Get an escalation policy state",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, EscalationPolicyParams.ESCALATION_POLICY_STATE_ID],
        request=None,
        responses={
            200: EscalationPolicySerializerResponse,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=None,  # TODO:
    )
    def get(self, request: Request, organization, escalation_policy_state) -> Response:
        """
        Return a single escalation policy state
        """
        return Response(serialize(escalation_policy_state, EscalationPolicyStateSerializer()))

    @extend_schema(
        operation_id="Update an Escalation Policy State",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            EscalationPolicyParams.ESCALATION_POLICY_ID,
            EscalationPolicyParams.ESCALATION_STATE,
        ],
        request=None,
        responses={
            204: None,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=None,  # TODO:
    )
    def put(self, request: Request, organization, escalation_policy_state) -> Response:
        """
        Update an escalation policy state
        """
        serializer = EscalationPolicyStatePutSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        new_state = request.data.get(EscalationPolicyParams.ESCALATION_STATE.name, None)
        if new_state is not None:
            escalation_policy_state = alter_escalation_policy_state(
                escalation_policy_state, EscalationPolicyStateType(new_state)
            )
        return Response(serialize(escalation_policy_state, EscalationPolicyStateSerializer()))
