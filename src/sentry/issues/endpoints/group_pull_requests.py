from __future__ import annotations

from datetime import datetime
from typing import Literal, TypedDict

from django.db.models import Exists, OuterRef
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.pullrequest import (
    PullRequestSerializer,
    PullRequestSerializerResponse,
)
from sentry.constants import ObjectStatus
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest, PullRequestLifecycleState
from sentry.models.repository import Repository

DEFAULT_LIMIT = 5

PullRequestStatus = Literal["merged", "open", "closed", "draft", "unknown"]


class LinkedPullRequestResponse(PullRequestSerializerResponse):
    dateLinked: datetime
    status: PullRequestStatus


class GroupPullRequestsResponse(TypedDict):
    pullRequests: list[LinkedPullRequestResponse]


def _get_valid_group_pull_request_links(group: Group, organization_id: int) -> list[GroupLink]:
    """Return recent resolving pull request links with valid pull requests and active repositories."""
    active_repositories = Repository.objects.filter(
        id=OuterRef("repository_id"),
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
    )
    valid_pull_requests = PullRequest.objects.filter(
        id=OuterRef("linked_id"),
        organization_id=organization_id,
    ).filter(Exists(active_repositories))

    return list(
        GroupLink.objects.filter(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.pull_request,
            relationship=GroupLink.Relationship.resolves,
        )
        .filter(Exists(valid_pull_requests))
        .order_by("-datetime")[:DEFAULT_LIMIT]
    )


def _get_pull_request_status(pull_request: PullRequest) -> PullRequestStatus:
    if pull_request.state == PullRequestLifecycleState.MERGED:
        return "merged"
    if pull_request.state == PullRequestLifecycleState.CLOSED:
        return "closed"
    if pull_request.draft:
        return "draft"
    if pull_request.state == PullRequestLifecycleState.OPEN:
        return "open"
    return "unknown"


@cell_silo_endpoint
class GroupPullRequestsEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, group: Group) -> Response[GroupPullRequestsResponse]:
        if not features.has(
            "organizations:issue-details-linked-pull-requests",
            group.organization,
            actor=request.user,
        ):
            return Response(status=404)

        organization_id = group.project.organization_id
        group_links = _get_valid_group_pull_request_links(group, organization_id)
        if not group_links:
            return Response({"pullRequests": []})

        pull_request_ids = [link.linked_id for link in group_links]
        pull_requests_by_id = PullRequest.objects.filter(
            id__in=pull_request_ids,
            organization_id=organization_id,
        ).in_bulk()
        pull_requests = [
            pull_requests_by_id[pull_request_id]
            for pull_request_id in pull_request_ids
            if pull_request_id in pull_requests_by_id
        ]

        repositories_by_id = Repository.objects.filter(
            organization_id=organization_id,
            id__in={pull_request.repository_id for pull_request in pull_requests},
            status=ObjectStatus.ACTIVE,
        ).in_bulk()
        pull_requests = [
            pull_request
            for pull_request in pull_requests
            if pull_request.repository_id in repositories_by_id
        ]
        serialized_pull_requests = serialize(
            pull_requests, request.user, serializer=PullRequestSerializer()
        )
        serialized_by_id: dict[int, PullRequestSerializerResponse] = {
            pull_request.id: serialized
            for pull_request, serialized in zip(
                pull_requests, serialized_pull_requests, strict=False
            )
        }
        date_linked_by_pr_id = {link.linked_id: link.datetime for link in group_links}
        pull_request_responses: list[LinkedPullRequestResponse] = []
        for pull_request in pull_requests:
            serialized = serialized_by_id.get(pull_request.id)
            if serialized is None:
                continue

            pull_request_responses.append(
                {
                    **serialized,
                    "dateLinked": date_linked_by_pr_id[pull_request.id],
                    "status": _get_pull_request_status(pull_request),
                }
            )

        response: GroupPullRequestsResponse = {"pullRequests": pull_request_responses}

        return Response(response)
