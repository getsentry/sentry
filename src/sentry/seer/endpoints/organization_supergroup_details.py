from __future__ import annotations

import logging

import orjson
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.organization import Organization
from sentry.seer.signed_seer_api import make_supergroups_get_request

logger = logging.getLogger(__name__)


class OrganizationSupergroupDetailsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
    }


@cell_silo_endpoint
class OrganizationSupergroupDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ISSUE_DETECTION_BACKEND
    permission_classes = (OrganizationSupergroupDetailsPermission,)

    def get(self, request: Request, organization: Organization, supergroup_id: int) -> Response:
        if not features.has("organizations:top-issues-ui", organization, actor=request.user):
            return Response({"detail": "Feature not available"}, status=403)

        response = make_supergroups_get_request(
            body={
                "organization_id": organization.id,
                "supergroup_id": supergroup_id,
            },
            timeout=10,
        )

        if response.status >= 400:
            return Response(
                {"detail": "Supergroup not found"},
                status=response.status,
            )

        return Response(orjson.loads(response.data))
