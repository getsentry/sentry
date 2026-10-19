from datetime import datetime
from typing import TypedDict

from django.db.models import OuterRef, Q, Subquery
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers.models.pullrequest import LinkedPullRequestResponse
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.issues.linked_pull_requests import get_linked_pull_requests
from sentry.models.group import Group
from sentry.models.grouphistory import RESOLVED_STATUSES, GroupHistory, GroupHistoryStatus

_ISSUE_STATE_HISTORY_STATUSES = (
    GroupHistoryStatus.ONGOING,
    *RESOLVED_STATUSES,
    GroupHistoryStatus.IGNORED,
    GroupHistoryStatus.UNIGNORED,
    GroupHistoryStatus.REGRESSED,
    GroupHistoryStatus.ESCALATING,
    GroupHistoryStatus.ARCHIVED_UNTIL_ESCALATING,
    GroupHistoryStatus.ARCHIVED_FOREVER,
    GroupHistoryStatus.ARCHIVED_UNTIL_CONDITION_MET,
)


class GroupPullRequestsResponse(TypedDict):
    latestRegressionAt: datetime | None
    pullRequests: list[LinkedPullRequestResponse]


def _get_latest_regression_at(group: Group) -> datetime | None:
    previous_status = (
        GroupHistory.objects.filter(
            group_id=OuterRef("group_id"),
            status__in=_ISSUE_STATE_HISTORY_STATUSES,
        )
        .filter(
            Q(date_added__lt=OuterRef("date_added"))
            | Q(date_added=OuterRef("date_added"), id__lt=OuterRef("id"))
        )
        .order_by("-date_added", "-id")
        .values("status")[:1]
    )

    return (
        GroupHistory.objects.filter(
            group_id=group.id,
            status__in=(GroupHistoryStatus.REGRESSED, GroupHistoryStatus.ONGOING),
        )
        .alias(previous_status=Subquery(previous_status))
        .filter(
            Q(status=GroupHistoryStatus.REGRESSED)
            | Q(status=GroupHistoryStatus.ONGOING, previous_status__in=RESOLVED_STATUSES)
        )
        .order_by("-date_added", "-id")
        .values_list("date_added", flat=True)
        .first()
    )


@cell_silo_endpoint
class GroupPullRequestsEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {"GET": ApiPublishStatus.PRIVATE}

    def get(self, request: Request, group: Group) -> Response[GroupPullRequestsResponse]:
        pull_requests = get_linked_pull_requests(
            group,
            request.user,
            include_checks_and_review="checksAndReview" in request.GET.getlist("expand"),
        )
        return Response(
            {
                "latestRegressionAt": _get_latest_regression_at(group) if pull_requests else None,
                "pullRequests": list(pull_requests.values()),
            }
        )
