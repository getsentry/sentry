from __future__ import annotations

import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import (
    ControlSiloOrganizationEndpoint,
    OrganizationPermission,
)
from sentry.exceptions import NotRegistered
from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.pipeline import (
    IntegrationPipeline,
    IntegrationPipelineError,
    initialize_integration_pipeline,
)
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.base import Pipeline
from sentry.pipeline.types import PipelineStepAction

logger = logging.getLogger(__name__)

# All pipeline classes that can be driven via the API. The endpoint tries each
# in order and uses whichever one has a valid session for the request.
PIPELINE_CLASSES = (IntegrationPipeline, IdentityPipeline)


class PipelinePermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin", "org:integrations"],
        "POST": ["org:write", "org:admin", "org:integrations"],
    }


def _get_api_pipeline(
    request: Request, organization: RpcOrganization, pipeline_name: str
) -> Response | Pipeline:
    """Look up an active API-ready pipeline from the session, or return an error Response."""
    pipelines = {cls.pipeline_name: cls for cls in PIPELINE_CLASSES}
    if pipeline_name not in pipelines:
        return Response({"detail": "Invalid pipeline type"}, status=404)

    pipeline = pipelines[pipeline_name].get_for_request(request._request)
    if not pipeline or not pipeline.organization:
        return Response({"detail": "No active pipeline session."}, status=404)

    if not pipeline.is_valid() or pipeline.organization.id != organization.id:
        return Response({"detail": "Invalid pipeline state."}, status=404)

    if not pipeline.is_api_ready():
        return Response({"detail": "Pipeline does not support API mode."}, status=400)

    return pipeline


@control_silo_endpoint
class OrganizationPipelineEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (PipelinePermission,)

    def get(
        self, request: Request, organization: RpcOrganization, pipeline_name: str, **kwargs: object
    ) -> Response:
        result = _get_api_pipeline(request, organization, pipeline_name)
        if isinstance(result, Response):
            return result
        return Response(result.get_current_step_info())

    def post(
        self, request: Request, organization: RpcOrganization, pipeline_name: str, **kwargs: object
    ) -> Response:
        if request.data.get("action") == "initialize":
            return self._initialize_pipeline(request, organization, pipeline_name)

        result = _get_api_pipeline(request, organization, pipeline_name)
        if isinstance(result, Response):
            return result
        pipeline = result

        step_result = pipeline.api_advance(request._request, request.data)

        response_data = step_result.serialize()
        if step_result.action == PipelineStepAction.ADVANCE:
            response_data.update(pipeline.get_current_step_info())

        if step_result.action == PipelineStepAction.ERROR:
            return Response(response_data, status=400)

        return Response(response_data)

    def _initialize_pipeline(
        self, request: Request, organization: RpcOrganization, pipeline_name: str
    ) -> Response:
        if pipeline_name != IntegrationPipeline.pipeline_name:
            return Response(
                {"detail": "Initialization not supported for this pipeline."}, status=400
            )

        provider_id = request.data.get("provider")
        if not provider_id:
            return Response({"detail": "provider is required."}, status=400)

        try:
            pipeline = initialize_integration_pipeline(request._request, organization, provider_id)
        except NotRegistered:
            return Response({"detail": f"Unknown provider: {provider_id}"}, status=404)
        except IntegrationPipelineError as e:
            return Response({"detail": str(e)}, status=404 if e.not_found else 400)

        if not pipeline.is_api_ready():
            return Response({"detail": "Pipeline does not support API mode."}, status=400)

        pipeline.set_api_mode()

        return Response(pipeline.get_current_step_info())
