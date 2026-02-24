from __future__ import annotations

import logging

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.seer.explorer.client_utils import (
    explorer_connection_pool,
    has_seer_explorer_access_with_detail,
)
from sentry.seer.models import SeerApiError
from sentry.seer.signed_seer_api import make_signed_seer_api_request

logger = logging.getLogger(__name__)


class OrganizationSeerExplorerUpdatePermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read"],
    }


@region_silo_endpoint
class OrganizationSeerExplorerUpdateEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerExplorerUpdatePermission,)

    def post(self, request: Request, organization: Organization, run_id: int) -> Response:
        """
        Send an update event to explorer for a given run.
        """
        has_access, error = has_seer_explorer_access_with_detail(organization, request.user)
        if not has_access:
            return Response({"detail": error}, status=403)

        if not request.data:
            return Response(status=400, data={"error": "Need a body with a payload"})

        path = "/v1/automation/explorer/update"

        body = orjson.dumps(
            {
                **request.data,
                "run_id": run_id,
                "organization_id": organization.id,
            }
        )

        response = make_signed_seer_api_request(
            explorer_connection_pool,
            path,
            body,
        )

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)

        return Response(status=202, data=response.json())
