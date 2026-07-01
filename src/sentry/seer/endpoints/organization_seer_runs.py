from __future__ import annotations

from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.seer_run import SeerRunSerializer
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidSearchQuery
from sentry.models.organization import Organization
from sentry.seer.agent.client_utils import has_seer_agent_access_with_detail
from sentry.seer.runs_query import filtered_runs_queryset


class OrganizationSeerRunsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
    }


@cell_silo_endpoint
class OrganizationSeerRunsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    permission_classes = (OrganizationSeerRunsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List Seer runs for the organization, served from the Sentry-side mirror
        tables (``SeerRun``/``SeerAgentRun``).

        Returns all runs for the organization the caller can access by default
        (runs tied to projects the caller cannot access are excluded). Use
        ``is:mine`` in the query to scope results to the requesting user's runs.

        Query Parameters:
            query: Optional structured search string. Supports ``source``, ``type``,
                ``project``, ``is:agent``/``!is:agent``, ``is:mine``/``!is:mine``,
                and free-text title search.
        """
        has_access, error = has_seer_agent_access_with_detail(organization, request.user)
        if not has_access:
            raise PermissionDenied(error)

        query = request.GET.get("query", "").strip()
        accessible_project_ids = [
            p.id for p in self.get_projects(request, organization, include_all_accessible=True)
        ]

        # get_date_range_from_params raises InvalidParams (a DRF ParseError) on
        # bad date params, which DRF renders as a 400 on its own.
        start, end = get_date_range_from_params(request.GET, optional=True)

        try:
            queryset = filtered_runs_queryset(
                organization=organization,
                query=query,
                user_id=request.user.id,
                accessible_project_ids=accessible_project_ids,
                start=start,
                end=end,
            )
        except InvalidSearchQuery as e:
            # CodeQL complains about str(e) below but ~all handlers
            # of InvalidSearchQuery do the same as this.
            return Response({"detail": str(e)}, status=400)

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="-last_triggered_at",
            on_results=lambda runs: serialize(runs, request.user, SeerRunSerializer()),
            paginator_cls=OffsetPaginator,
            default_per_page=100,
            max_per_page=100,
        )
