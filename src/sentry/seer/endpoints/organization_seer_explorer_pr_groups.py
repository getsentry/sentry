from __future__ import annotations

import logging

import sentry_sdk
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import NoProjects, OrganizationEndpoint, OrganizationPermission
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
        # get_projects() parses ?project= from the query string, validates that
        # each project belongs to this org, and checks user access (prevents IDOR).
        # Raises PermissionDenied if any project is inaccessible.
        projects = self.get_projects(request, organization)
        if not projects:
            raise NoProjects("No projects available")
        project_ids = [p.id for p in projects]

        start, end = get_date_range_from_stats_period(request.GET, optional=True)

        try:
            client = SeerExplorerClient(organization, request.user)
            seer_data = client.get_pr_summaries()
        except SeerPermissionError as e:
            raise PermissionDenied(e.message) from e
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return Response({"detail": "Unexpected error calling Seer"}, status=502)

        if not seer_data:
            seer_data = []

        # Filter out runs without a group_id (non-autofix runs have group_id=None)
        seer_data = [item for item in seer_data if item.get("group_id") is not None]

        def data_fn(offset: int, limit: int) -> list[dict]:
            if not seer_data:
                return []

            group_ids = [item["group_id"] for item in seer_data]
            qs = Group.objects.filter(id__in=group_ids, project_id__in=project_ids)
            if start is not None:
                qs = qs.filter(last_seen__gte=start)
            if end is not None:
                qs = qs.filter(last_seen__lte=end)
            groups = list(qs)

            if not groups:
                return []

            try:
                serialized_groups = serialize(
                    groups,
                    request.user,
                    GroupSerializerSnuba(
                        organization_id=organization.id,
                        project_ids=project_ids,
                    ),
                    request=request,
                )
            except Exception as e:
                sentry_sdk.capture_exception(e)
                return []

            seer_data_by_group_id = {item["group_id"]: item for item in seer_data}

            for serialized_group in serialized_groups:
                group_id = int(serialized_group["id"])
                item = seer_data_by_group_id.get(group_id)
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
                            for repo_name, state in item.get("repo_pr_states", {}).items()
                            if isinstance(state, dict)
                        },
                    }

            return serialized_groups[offset : offset + limit]

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            default_per_page=25,
        )
