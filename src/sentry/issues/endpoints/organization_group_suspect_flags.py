import logging
from datetime import timedelta
from typing import TypedDict

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
from sentry.issues.suspect_flags import Distribution, get_suspect_flag_scores
from sentry.models.group import Group
from sentry.utils import metrics


class ResponseDataItem(TypedDict):
    flag: str
    score: float
    baseline_percent: float
    distribution: Distribution
    is_filtered: bool


class ResponseData(TypedDict):
    data: list[ResponseDataItem]


@region_silo_endpoint
class OrganizationGroupSuspectFlagsEndpoint(GroupEndpoint):
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    @deprecated(CELL_API_DEPRECATION_DATE, url_names=["sentry-api-0-suspect-flags"])
    def get(self, request: Request, group: Group) -> Response:
        """Stats bucketed by time."""
        if not features.has(
            "organizations:feature-flag-suspect-flags",
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

        response_data: ResponseData = {
            "data": get_suspect_flag_scores(
                organization_id,
                project_id,
                start,
                end,
                environments,
                group_id,
            )
        }

        # Record a distribution of suspect flag scores.
        for item in response_data["data"]:
            metrics.distribution("flags.suspect.score", item["score"])
            if item["score"] >= 1:
                logging.info(
                    "sentry.replays.slow_click",
                    extra={
                        "event_type": "flag_score_log",
                        "org_id": group.organization.id,
                        "project_id": group.project.id,
                        "flag": item["flag"],
                        "score": item["score"],
                        "issue_id": group.id,
                        "is_filtered": item["is_filtered"],
                    },
                )

        return Response(response_data, status=200)
