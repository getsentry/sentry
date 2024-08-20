from __future__ import annotations

from drf_spectacular.utils import extend_schema
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
from sentry.apidocs.parameters import EscalationPolicyParams, GlobalParams, ReleaseParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.escalation_policies.endpoints.serializers.escalation_policy_state import (
    EscalationPolicyStateSerializer,
    EscalationPolicyStateSerializerResponse,
)
from sentry.escalation_policies.models.escalation_policy_state import EscalationPolicyState


@extend_schema(tags=["Escalation Policies"])
@region_silo_endpoint
class OrganizationEscalationPolicyStateIndexEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationPermission,)

    @extend_schema(
        operation_id="List an Organization's Escalation Policy states filtered by the given parameters",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            ReleaseParams.PROJECT_ID,
            EscalationPolicyParams.ESCALATION_STATE,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListEscalationPolicyStates", list[EscalationPolicyStateSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=EscalationPolicyExamples.LIST_ESCALATION_POLICIES,
    )
    def get(self, request: Request, organization) -> Response:
        """
        Return a list of escalation policy states filtered by the given parameters.
        """
        queryset = EscalationPolicyState.objects.filter(
            escalation_policy__organization_id=organization.id,
        )
        if request.GET.get(EscalationPolicyParams.ESCALATION_STATE.name, None) is not None:
            queryset = queryset.filter(
                state=request.GET[EscalationPolicyParams.ESCALATION_STATE.name]
            )
        if request.GET.get(ReleaseParams.PROJECT_ID.name, None) is not None:
            queryset = queryset.filter(group__project_id=request.GET[ReleaseParams.PROJECT_ID.name])

        serializer = EscalationPolicyStateSerializer()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=("id",),
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user, serializer=serializer),
        )
