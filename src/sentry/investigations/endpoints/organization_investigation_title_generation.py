from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.apidocs import constants
from sentry.apidocs.parameters import GlobalParams, InvestigationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.investigations.agent import synchronize_title, title_generation_preview
from sentry.investigations.endpoints.serializers.responses import InvestigationTitlePreviewResponse
from sentry.models.organization import Organization
from sentry.notebooks.endpoints.base import OrganizationInvestigationEndpoint
from sentry.notebooks.models import Notebook
from sentry.seer.agent.client import SeerAgentClient


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationTitleGenerationEndpoint(OrganizationInvestigationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    @extend_schema(
        operation_id="Retrieve an Investigation Title Preview",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, InvestigationParams.INVESTIGATION_ID],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "InvestigationTitlePreviewResponse", InvestigationTitlePreviewResponse
            ),
            400: constants.RESPONSE_BAD_REQUEST,
            401: constants.RESPONSE_UNAUTHORIZED,
            403: constants.RESPONSE_FORBIDDEN,
            404: constants.RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        investigation: Notebook,
    ) -> Response:
        """
        Internal UI polling. Synchronize automatic title generation and return its status and
        partial title preview. Both values may be null when no generation exists. Requires the
        organizations:investigations feature and open organization membership.
        """
        preview = None
        if investigation.title_seer_run and investigation.title_seer_run.seer_run_state_id:
            state = SeerAgentClient(organization, request.user).get_run(
                investigation.title_seer_run.seer_run_state_id
            )
            synchronize_title(investigation, state)
            investigation.refresh_from_db()
            content = next(
                (
                    state_block.message.content
                    for state_block in reversed(state.blocks)
                    if state_block.message.role == "assistant" and state_block.message.content
                ),
                None,
            )
            preview = title_generation_preview(content)
        response_data: InvestigationTitlePreviewResponse = {
            "status": investigation.title_generation_status,
            "preview": preview,
        }
        return Response(response_data)
