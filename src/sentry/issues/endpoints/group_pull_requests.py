from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping, Sequence
from typing import TypedDict, cast

from django.db.models import Exists, OuterRef
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.pullrequest import (
    LinkedPullRequestResponse,
    LinkedPullRequestSerializer,
    PullRequestStatus,
    get_stored_pull_request_status,
)
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.status_check import (
    PullRequestStatusClient,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 5


class ProviderPullRequestResponse(TypedDict, total=False):
    draft: bool
    merged: bool
    state: str


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


def _get_pull_request_repo_name(repository: Repository) -> str:
    config_name = repository.config.get("name")
    if isinstance(config_name, str) and config_name:
        return config_name
    return repository.name


def _get_provider_installation(
    pull_request: PullRequest, repository: Repository
) -> IntegrationInstallation | None:
    """The repository's active integration, installed for the pull request's organization."""
    if repository.integration_id is None:
        return None

    integration = integration_service.get_integration(
        integration_id=repository.integration_id,
        organization_id=pull_request.organization_id,
        status=ObjectStatus.ACTIVE,
    )
    if integration is None:
        return None

    return integration.get_installation(organization_id=pull_request.organization_id)


def _fetch_pull_request_status_response(
    pull_request: PullRequest, repository: Repository
) -> ProviderPullRequestResponse | None:
    installation = _get_provider_installation(pull_request, repository)
    if installation is None:
        return None

    get_pull_request = getattr(installation.get_client(), "get_pull_request", None)
    if not callable(get_pull_request):
        return None

    response = get_pull_request(_get_pull_request_repo_name(repository), pull_request.key)
    if not isinstance(response, Mapping):
        return None

    provider_response: ProviderPullRequestResponse = {
        "draft": bool(response.get("draft")),
        "merged": bool(response.get("merged")),
    }
    state = response.get("state")
    if isinstance(state, str):
        provider_response["state"] = state

    return provider_response


def _get_provider_pull_request_status(
    pull_request: PullRequest, repository: Repository | None
) -> PullRequestStatus:
    if repository is None:
        return "unknown"

    try:
        response = _fetch_pull_request_status_response(pull_request, repository)
    except Exception:
        logger.info(
            "group_pull_requests.status_fetch_failed",
            exc_info=True,
            extra={
                "organization_id": pull_request.organization_id,
                "pull_request_id": pull_request.id,
                "repository_id": pull_request.repository_id,
            },
        )
        return "unknown"

    if response is None:
        return "unknown"

    if response.get("merged"):
        return "merged"
    state = response.get("state")
    if state == "closed":
        return "closed"
    if response.get("draft"):
        return "draft"
    if state == "open":
        return "open"
    return "unknown"


def _get_pull_request_status(
    pull_request: PullRequest, repository: Repository | None
) -> PullRequestStatus:
    stored_status = get_stored_pull_request_status(pull_request)
    if stored_status is not None:
        return stored_status

    return _get_provider_pull_request_status(pull_request, repository)


def _get_checks_and_review(
    pull_requests: Sequence[PullRequest],
    repositories_by_id: Mapping[int, Repository],
    lifecycle_status_by_pr_id: Mapping[int, PullRequestStatus],
) -> dict[int, PullRequestStatusResult]:
    """Fetch open pull requests in one provider request per integration."""
    requests_by_integration_id: dict[
        int, list[tuple[PullRequest, Repository, PullRequestStatusRequest]]
    ] = defaultdict(list)

    for pull_request in pull_requests:
        repository = repositories_by_id.get(pull_request.repository_id)
        if (
            repository is None
            or repository.integration_id is None
            or lifecycle_status_by_pr_id[pull_request.id] not in ("open", "draft")
        ):
            continue

        request = PullRequestStatusRequest(
            repo=_get_pull_request_repo_name(repository), pull_number=pull_request.key
        )
        requests_by_integration_id[repository.integration_id].append(
            (pull_request, repository, request)
        )

    results_by_pr_id: dict[int, PullRequestStatusResult] = {}
    for integration_id, request_items in requests_by_integration_id.items():
        representative_pull_request, representative_repository, _ = request_items[0]
        try:
            installation = _get_provider_installation(
                representative_pull_request, representative_repository
            )
            if installation is None:
                continue

            client = installation.get_client()
            if not isinstance(client, PullRequestStatusClient):
                continue

            status_by_request = client.get_pull_request_statuses(
                [request for _, _, request in request_items]
            )
        except Exception:
            logger.info(
                "group_pull_requests.checks_and_review_fetch_failed",
                exc_info=True,
                extra={
                    "organization_id": representative_pull_request.organization_id,
                    "integration_id": integration_id,
                    "pull_request_ids": [pull_request.id for pull_request, _, _ in request_items],
                },
            )
            continue

        for pull_request, _, request in request_items:
            results_by_pr_id[pull_request.id] = status_by_request.get(
                request, PullRequestStatusResult()
            )

    return results_by_pr_id


@cell_silo_endpoint
class GroupPullRequestsEndpoint(GroupEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, group: Group) -> Response[GroupPullRequestsResponse]:
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

        date_linked_by_pr_id = {link.linked_id: link.datetime for link in group_links}
        status_by_pr_id = {
            pull_request.id: _get_pull_request_status(
                pull_request, repositories_by_id.get(pull_request.repository_id)
            )
            for pull_request in pull_requests
        }

        checks_and_review_by_pr_id: dict[int, PullRequestStatusResult] = {}
        if "checksAndReview" in request.GET.getlist("expand") and features.has(
            "organizations:issue-pr-checks-status", group.project.organization
        ):
            checks_and_review_by_pr_id = _get_checks_and_review(
                pull_requests, repositories_by_id, status_by_pr_id
            )

        # serialize() infers the base PullRequestSerializerResponse from the
        # parent's generic; LinkedPullRequestSerializer returns the narrower type.
        pull_request_responses = cast(
            list[LinkedPullRequestResponse],
            serialize(
                pull_requests,
                request.user,
                serializer=LinkedPullRequestSerializer(
                    date_linked_by_pr_id=date_linked_by_pr_id,
                    status_by_pr_id=status_by_pr_id,
                    checks_and_review_by_pr_id=checks_and_review_by_pr_id,
                ),
            ),
        )

        response: GroupPullRequestsResponse = {"pullRequests": pull_request_responses}

        return Response(response)
