from __future__ import annotations

import logging

from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import GroupSerializerSnuba
from sentry.api.utils import get_date_range_from_stats_period
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.models import SeerPermissionError

logger = logging.getLogger(__name__)


class OrganizationSeerExplorerPRGroupsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read"],
    }


@region_silo_endpoint
class OrganizationSeerExplorerPRGroupsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    enforce_rate_limit = True
    permission_classes = (OrganizationSeerExplorerPRGroupsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Get a list of issues that have a PR created from Seer Explorer

        Query Parameters:
            None
        """

        # get_projects() parses ?project= from the query string, validates that
        # each project belongs to this org, and checks user access (prevents IDOR).
        # Raises PermissionDenied if any project is inaccessible.
        projects = self.get_projects(request, organization)
        if not projects:
            return Response([])
        project_ids = [p.id for p in projects]

        start, end = get_date_range_from_stats_period(request.GET, optional=True)

        def _make_seer_runs_request(offset: int, limit: int) -> dict[str, list[dict]]:
            try:
                client = SeerExplorerClient(organization, request.user)
                seer_data = client.get_runs(
                    offset=offset, limit=limit, only_current_user=False, expand="prs"
                )
            except SeerPermissionError as e:
                raise PermissionDenied(e.message) from e

            if not seer_data:
                return {"data": []}

            # Convert Pydantic models to dicts for consistent access downstream
            runs = [run.dict() for run in seer_data]

            # Filter out runs without a group_id (non-autofix runs have group_id=None)
            runs = [item for item in runs if item.get("group_id") is not None]

            if not runs:
                return {"data": []}

            group_ids = [item["group_id"] for item in runs]
            qs = Group.objects.filter(id__in=group_ids, project_id__in=project_ids)
            if start is not None:
                qs = qs.filter(last_seen__gte=start)
            if end is not None:
                qs = qs.filter(last_seen__lte=end)
            groups = list(qs)

            if not groups:
                return {"data": []}

            serialized_groups = serialize(
                groups,
                request.user,
                GroupSerializerSnuba(
                    organization_id=organization.id,
                    project_ids=project_ids,
                ),
                request=request,
            )

            # Runs are sorted newest-first; keep only the first entry per group_id
            runs_by_group_id: dict[int, dict] = {}
            for item in runs:
                runs_by_group_id.setdefault(item["group_id"], item)

            for serialized_group in serialized_groups:
                group_id = int(serialized_group["id"])
                item = runs_by_group_id.get(group_id)
                if item:
                    serialized_group["explorerPrData"] = {
                        "runId": item["run_id"],
                        "userId": item["user_id"],
                        "createdAt": item["created_at"],
                        "repoPrStates": {
                            repo_name: {
                                "repoName": state.get("repo_name", repo_name),
                                "branchName": state.get("branch_name"),
                                "prNumber": state.get("pr_number"),
                                "prUrl": state.get("pr_url"),
                                "prCreationStatus": state.get("pr_creation_status"),
                            }
                            for repo_name, state in (item.get("repo_pr_states") or {}).items()
                            if isinstance(state, dict)
                        },
                    }

            return {"data": serialized_groups}

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=_make_seer_runs_request),
            default_per_page=25,
        )
