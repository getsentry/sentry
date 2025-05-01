from __future__ import annotations

import logging

import orjson
import requests
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.seer_setup import get_seer_org_acknowledgement, get_seer_user_acknowledgement
from sentry.seer.signed_seer_api import sign_with_seer_secret

logger = logging.getLogger(__name__)

from rest_framework.request import Request


def fire_setup_request(org_id: int, project_ids: list[int]) -> None:
    """
    Sends a request to seer to create the initial cached prompt / setup the AI models
    """
    body = orjson.dumps(
        {
            "org_id": org_id,
            "project_ids": project_ids,
        }
    )

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}/v1/assisted-query/create-cache",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )
    response.raise_for_status()


@region_silo_endpoint
class TraceExplorerAISetup(ProjectEndpoint):
    """
    This endpoint is called when a user visits the trace explorer with the correct flags enabled.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI

    def post(self, request: Request, project: Project) -> Response:
        """
        Checks if we are able to run Autofix on the given group.
        """
        org: Organization = request.organization

        if not features.has("organizations:gen-ai-explore-traces", organization=org):
            return Response(
                {"detail": "Organization does not have access to this feature"},
                status=status.HTTP_403_FORBIDDEN,
            )
        user_acknowledgement = get_seer_user_acknowledgement(user_id=request.user.id, org_id=org.id)
        org_acknowledgement = user_acknowledgement or get_seer_org_acknowledgement(org_id=org.id)

        if not org_acknowledgement:
            return Response(
                {"detail": "Organization has not opted in to this feature."},
                status=status.HTTP_403_FORBIDDEN,
            )

        fire_setup_request(org.id, [project.id])

        return Response({"status": "ok"})
