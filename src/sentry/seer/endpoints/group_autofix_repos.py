from __future__ import annotations

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.issues.endpoints.bases.group import GroupAiEndpoint
from sentry.models.group import Group
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@cell_silo_endpoint
class GroupAutofixReposEndpoint(GroupAiEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ML_AI
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

    def get(self, request: Request, group: Group) -> Response:
        try:
            client = SeerAgentClient(
                organization=group.organization,
                user=None,
                category_key="autofix",
                category_value=str(group.id),
            )
        except SeerPermissionError:
            return Response(
                {"detail": "Seer access is not enabled for this organization"},
                status=status.HTTP_403_FORBIDDEN,
            )

        run = client.latest_run(group_id=group.id)
        if run is None:
            return Response({"repos": []}, status=status.HTTP_200_OK)

        try:
            response = client.get_repos(run.run.seer_run_state_id)
        except Exception:
            return Response(
                {"detail": "Failed to reach Seer"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        if response.status == 404:
            return Response({"repos": []}, status=status.HTTP_200_OK)

        if response.status >= 400:
            raise SeerApiError("Seer request failed", response.status)

        return Response(response.json(), status=status.HTTP_200_OK)
