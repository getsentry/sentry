from datetime import timedelta

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.helpers.deprecation import deprecated
from sentry.api.helpers.environments import get_environments
from sentry.api.utils import get_date_range_from_params
from sentry.constants import CELL_API_DEPRECATION_DATE
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.issues.suspect_tags import get_suspect_tag_scores
from sentry.models.group import Group


@region_silo_endpoint
class OrganizationGroupSuspectTagsEndpoint(GroupEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-suspect-tags"])
    def get(self, request: Request, group: Group) -> Response:
        """Stats bucketed by time."""
        if not features.has(
            "organizations:issues-suspect-tags",
            group.organization,
            actor=request.user,
        ):
            return Response(status=404)

        environments = [e.name for e in get_environments(request, group.organization)]
        group_id = group.id
        organization_id = group.organization.id
        project_id = group.project.id
        start, end = get_date_range_from_params(request.GET)

        # Clamp the range to be within the issue's first and last seen timestamps.
        start, end = max(start, group.first_seen), min(end, group.last_seen)

        # To increase our cache hit-rate we round the dates down to the nearest 5 minute interval.
        if end - start > timedelta(minutes=5):
            start = start.replace(minute=(start.minute // 5) * 5, second=0, microsecond=0)
            end = end.replace(minute=(end.minute // 5) * 5, second=0, microsecond=0)

        return Response(
            {
                "data": [
                    {"tag": tag, "score": score}
                    for tag, score in get_suspect_tag_scores(
                        organization_id,
                        project_id,
                        start,
                        end,
                        environments,
                        group_id,
                    )
                ]
            },
            status=200,
        )
