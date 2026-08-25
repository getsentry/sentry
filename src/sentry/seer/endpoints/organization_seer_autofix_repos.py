from __future__ import annotations

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models import SeerPermissionError
from sentry.seer.models.run import SeerAgentRun
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

_MAX_WORKERS = 10


class OrganizationSeerAutofixReposPermission(OrganizationPermission):
    scope_map = {"GET": ["org:read"]}


@cell_silo_endpoint
class OrganizationSeerAutofixReposEndpoint(OrganizationEndpoint):
    """Batch sibling of the per-group ``autofix/repos/`` endpoint.

    Returns ``{group_id: {repos: [...]}}`` for many groups in one request so the
    overview page fetches repos once instead of once per card. Access flags are
    per-(org, repo), so batching lets Seer's work be shared across cards.
    """

    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    owner = ApiOwner.ML_AI
    permission_classes = (OrganizationSeerAutofixReposPermission,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=500, window=60, concurrent_limit=100),
                RateLimitCategory.USER: RateLimit(limit=500, window=60, concurrent_limit=100),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=1000, window=60, concurrent_limit=100
                ),
            }
        }
    )

    def get(self, request: Request, organization: Organization) -> Response:
        group_ids = _parse_group_ids(request)
        if not group_ids:
            return Response({}, status=status.HTTP_200_OK)

        try:
            client = SeerAgentClient(organization=organization, user=None)
        except SeerPermissionError:
            return Response(
                {"detail": "Seer access is not enabled for this organization"},
                status=status.HTTP_403_FORBIDDEN,
            )

        accessible_group_ids = _accessible_group_ids(request, organization, group_ids)
        if not accessible_group_ids:
            return Response({}, status=status.HTTP_200_OK)

        state_id_by_group = _latest_state_id_per_group(organization, accessible_group_ids)

        result: dict[str, dict[str, list]] = {}
        # A group with no run has no repos to report; the per-group endpoint
        # returns the same legitimate empty for this case.
        for group_id in accessible_group_ids:
            if group_id not in state_id_by_group:
                result[str(group_id)] = {"repos": []}

        def fetch(item: tuple[int, int]) -> tuple[int, dict[str, list] | None]:
            group_id, state_id = item
            try:
                response = client.get_repos(state_id)
            except Exception:
                return group_id, None
            if response.status == 404:
                return group_id, {"repos": []}
            if response.status >= 400:
                return group_id, None
            return group_id, response.json()

        if state_id_by_group:
            with ContextPropagatingThreadPoolExecutor(max_workers=_MAX_WORKERS) as executor:
                for group_id, repos in executor.map(fetch, state_id_by_group.items()):
                    # Omit (rather than fabricate empty) when Seer fails, so the
                    # client can fall back instead of trusting a false "no repos".
                    if repos is not None:
                        result[str(group_id)] = repos

        return Response(result, status=status.HTTP_200_OK)


def _parse_group_ids(request: Request) -> set[int]:
    group_ids: set[int] = set()
    for raw in request.GET.getlist("group"):
        try:
            group_ids.add(int(raw))
        except (TypeError, ValueError):
            continue
    return group_ids


def _accessible_group_ids(
    request: Request, organization: Organization, group_ids: set[int]
) -> list[int]:
    groups = Group.objects.filter(
        id__in=group_ids, project__organization_id=organization.id
    ).select_related("project")
    return [group.id for group in groups if request.access.has_project_access(group.project)]


def _latest_state_id_per_group(organization: Organization, group_ids: list[int]) -> dict[int, int]:
    rows = (
        SeerAgentRun.objects.filter(
            run__organization_id=organization.id,
            source="autofix",
            group_id__in=group_ids,
            run__seer_run_state_id__isnull=False,
        )
        .select_related("run")
        .order_by("-run__last_triggered_at")
    )
    # Rows are newest-first, so the first run seen for a group is its latest.
    latest: dict[int, int] = {}
    for row in rows:
        if row.group_id not in latest:
            latest[row.group_id] = row.run.seer_run_state_id
    return latest
