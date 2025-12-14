from __future__ import annotations

import logging
from typing import Any

from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import GenericOffsetPaginator
from sentry.models.organization import Organization
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.models import SeerPermissionError

logger = logging.getLogger(__name__)


class OrganizationSeerExplorerRunsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
    }


@region_silo_endpoint
class OrganizationSeerExplorerRunsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    permission_classes = (OrganizationSeerExplorerRunsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get a list of explorer runs triggered by the requesting user.

        Query Parameters:
            category_key: Optional category key to filter by (e.g., "bug-fixer", "researcher")
            category_value: Optional category value to filter by (e.g., "issue-123", "a5b32")
        """

        category_key = request.GET.get("category_key")
        category_value = request.GET.get("category_value")

        def _make_seer_runs_request(offset: int, limit: int) -> dict[str, Any]:
            try:
                client = SeerExplorerClient(organization, request.user)
                runs = client.get_runs(
                    category_key=category_key,
                    category_value=category_value,
                    offset=offset,
                    limit=limit,
                )
            except SeerPermissionError as e:
                raise PermissionDenied(e.message) from e

            return {"data": [run.dict() for run in runs]}

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=_make_seer_runs_request),
            default_per_page=100,
        )
