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
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import sign_with_seer_secret

logger = logging.getLogger(__name__)

from rest_framework.request import Request


class OrganizationTraceExplorerAIPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


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
class TraceExplorerAISetup(OrganizationEndpoint):
    """
    This endpoint is called when a user visits the trace explorer with the correct flags enabled.
    """

    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI

    permission_classes = (OrganizationTraceExplorerAIPermission,)

    @staticmethod
    def post(request: Request, organization: Organization) -> Response:
        """
        Checks if we are able to run Autofix on the given group.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        project_ids = [int(x) for x in request.data.get("project_ids", [])]

        if organization.get_option("sentry:hide_ai_features", False):
            return Response(
                {"detail": "AI features are disabled for this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not features.has(
            "organizations:gen-ai-features", organization=organization, actor=request.user
        ):
            return Response(
                {"detail": "Organization does not have access to this feature"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not settings.SEER_AUTOFIX_URL:
            return Response(
                {"detail": "Seer is not properly configured."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        fire_setup_request(organization.id, project_ids)

        return Response({"status": "ok"})
