from __future__ import annotations

import logging

import sentry_sdk
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
        # each project belongs to this org, and checks user access.
        projects = self.get_projects(request, organization)
        project_ids = [p.id for p in projects]

        start, end = get_date_range_from_stats_period(request.GET, optional=True)

        def _make_seer_runs_request(offset: int, limit: int) -> dict[str, list[dict]]:
            try:
                client = SeerExplorerClient(organization, request.user)
                seer_data = client.get_runs(
                    category_key="autofix",
                    offset=offset,
                    limit=limit,
                    only_current_user=False,
                    expand="prs",
                    project_ids=project_ids,
                    start=start,
                    end=end,
                )
            except SeerPermissionError as e:
                raise PermissionDenied(e.message) from e

            if not seer_data:
                return {"data": []}

            runs = list(seer_data)

            if not runs:
                return {"data": []}

            group_ids = [run.group_id for run in runs if run.group_id is not None]
            groups_by_id: dict[str, dict] = {}

            if group_ids:
                qs = Group.objects.filter(id__in=group_ids, project_id__in=project_ids)
                groups = list(qs)

                if groups:
                    serialized_groups = serialize(
                        groups,
                        request.user,
                        GroupSerializerSnuba(
                            organization_id=organization.id,
                            project_ids=project_ids,
                        ),
                        request=request,
                    )
                    groups_by_id = {sg["id"]: sg for sg in serialized_groups}

            results: list[dict] = []
            for run in runs:
                serialized_group = None
                if run.group_id is not None:
                    serialized_group = groups_by_id.get(str(run.group_id))
                    if serialized_group is None:
                        sentry_sdk.capture_message(
                            f"Seer Explorer PR group not found: group_id={run.group_id}",
                            level="warning",
                        )
                else:
                    sentry_sdk.capture_message(
                        f"Seer Explorer PR run has no group_id: run_id={run.run_id}",
                        level="warning",
                    )

                results.append(
                    {
                        "runId": run.run_id,
                        "userId": run.user_id,
                        "createdAt": run.created_at,
                        "repoPrStates": {
                            repo_name: {
                                "repoName": state.repo_name,
                                "branchName": state.branch_name,
                                "prNumber": state.pr_number,
                                "prUrl": state.pr_url,
                                "prCreationStatus": state.pr_creation_status,
                            }
                            for repo_name, state in (run.repo_pr_states or {}).items()
                        },
                        "group": serialized_group,
                    }
                )

            return {"data": results}

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=_make_seer_runs_request),
            default_per_page=25,
        )
