from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, tagstore
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.endpoints.group_details import get_group_stats
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import get_date_range_from_params
from sentry.exceptions import InvalidSearchQuery
from sentry.issues.grouptype import GroupCategory
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.dates import get_rollup_from_request


@region_silo_endpoint
class GroupDetailedStatsEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(limit=5, window=1),
            RateLimitCategory.USER: RateLimit(limit=5, window=1),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=1),
        }
    }

    def get(self, request: Request, group) -> Response:
        if not (
            features.has(
                "organizations:issue-details-streamline",
                group.project.organization,
                actor=request.user,
            )
        ):
            raise ResourceDoesNotExist

        environments = get_environments(request, group.project.organization)
        environment_ids = [e.id for e in environments]
        start, end = get_date_range_from_params(request.GET)
        try:
            rollup = get_rollup_from_request(
                request,
                end - start,
                default_interval=None,
                error=InvalidSearchQuery(),
            )
        except InvalidSearchQuery:
            rollup = 3600  # use a default of 1 hour

        event_stats = get_group_stats(
            group=group, environment_ids=environment_ids, start=start, end=end, rollup=rollup
        )

        user_count_func = (
            tagstore.backend.get_groups_user_counts
            if group.issue_category == GroupCategory.ERROR
            else tagstore.backend.get_generic_groups_user_counts
        )
        user_count = user_count_func(
            project_ids=[group.project_id],
            group_ids=[group.id],
            environment_ids=environment_ids,
            start=start,
            end=end,
            tenant_ids={"organization_id": group.project.organization_id},
        )
        return Response(
            {
                "eventStats": event_stats,
                "userCount": user_count[group.id],
                "rollup": rollup,
                "start": start,
                "end": end,
            }
        )
