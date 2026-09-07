from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.investigations.agent import synchronize_title, title_generation_preview
from sentry.investigations.endpoints.base import OrganizationInvestigationEndpoint
from sentry.investigations.models import Investigation
from sentry.models.organization import Organization
from sentry.seer.agent.client import SeerAgentClient


@extend_schema(tags=["Investigations"])
@cell_silo_endpoint
class OrganizationInvestigationTitleGenerationEndpoint(OrganizationInvestigationEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(
        self,
        request: Request,
        organization: Organization,
        investigation: Investigation,
    ) -> Response:
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
        return Response({"status": investigation.title_generation_status, "preview": preview})
