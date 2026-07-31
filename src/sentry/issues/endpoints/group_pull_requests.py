from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import TypedDict, cast

from django.core.cache import cache
from django.db.models import Exists, OuterRef
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.pullrequest import (
    KNOWN_MERGEABLE_STATES,
    LinkedPullRequestResponse,
    LinkedPullRequestSerializer,
    PullRequestMergeableState,
    PullRequestStatus,
    get_stored_pull_request_status,
)
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.issues.endpoints.bases.group import GroupEndpoint
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository

logger = logging.getLogger(__name__)

DEFAULT_LIMIT = 5

# How long a provider PR lookup is reused before refetching. Mergeability can
# flip whenever checks finish, so keep this short — it only needs to absorb
# bursts of page renders, not stay fresh for long.
PROVIDER_PR_CACHE_TTL = 120


class ProviderPullRequestResponse(TypedDict, total=False):
    draft: bool
    merged: bool
    mergeable_state: str
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


def _fetch_pull_request_status_response(
    pull_request: PullRequest, repository: Repository
) -> ProviderPullRequestResponse | None:
    if repository.integration_id is None:
        return None

    integration = integration_service.get_integration(
        integration_id=repository.integration_id,
        organization_id=pull_request.organization_id,
        status=ObjectStatus.ACTIVE,
    )
    if integration is None:
        return None

    installation = integration.get_installation(organization_id=pull_request.organization_id)
    client = installation.get_client()
    get_pull_request = getattr(client, "get_pull_request", None)
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
    mergeable_state = response.get("mergeable_state")
    if isinstance(mergeable_state, str):
        provider_response["mergeable_state"] = mergeable_state.lower()

    return provider_response


def _fetch_provider_pull_request_cached(
    pull_request: PullRequest, repository: Repository
) -> ProviderPullRequestResponse | None:
    """Provider PR lookup with a short-lived cache.

    Open PRs are looked up on every request (mergeability changes as checks
    finish); the cache only absorbs bursts of renders so a page of cards
    doesn't spend provider rate limit per re-render.
    """
    cache_key = f"group-pull-requests:provider-pr:{repository.integration_id}:{pull_request.id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cast(ProviderPullRequestResponse, cached)

    response = _fetch_pull_request_status_response(pull_request, repository)
    if response is not None:
        cache.set(cache_key, response, PROVIDER_PR_CACHE_TTL)
    return response


def _get_provider_pull_request_info(
    pull_request: PullRequest, repository: Repository | None
) -> tuple[PullRequestStatus | None, PullRequestMergeableState | None]:
    """Live status + merge readiness; (None, None) when the provider is unavailable."""
    if repository is None:
        return None, None

    try:
        response = _fetch_provider_pull_request_cached(pull_request, repository)
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
        return None, None

    if response is None:
        return None, None

    status: PullRequestStatus = "unknown"
    state = response.get("state")
    if response.get("merged"):
        status = "merged"
    elif state == "closed":
        status = "closed"
    elif response.get("draft"):
        status = "draft"
    elif state == "open":
        status = "open"

    mergeable_state: PullRequestMergeableState | None = None
    raw_mergeable_state = response.get("mergeable_state")
    # Merge readiness is only meaningful while the PR can still be merged.
    if raw_mergeable_state and status not in ("merged", "closed"):
        mergeable_state = cast(
            PullRequestMergeableState,
            raw_mergeable_state if raw_mergeable_state in KNOWN_MERGEABLE_STATES else "unknown",
        )

    return status, mergeable_state


def _get_pull_request_state(
    pull_request: PullRequest, repository: Repository | None
) -> tuple[PullRequestStatus, PullRequestMergeableState | None]:
    """Resolve a PR's lifecycle status and merge readiness.

    Terminal PRs (merged/closed) are answered from the stored, webhook-kept
    fields without a provider round-trip. Everything else asks the provider —
    the stored row can't answer merge readiness — falling back to the stored
    status when the provider is unavailable.
    """
    stored_status = get_stored_pull_request_status(pull_request)
    if stored_status in ("merged", "closed"):
        return stored_status, None

    provider_status, mergeable_state = _get_provider_pull_request_info(pull_request, repository)
    status = provider_status or stored_status or "unknown"
    return status, mergeable_state


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
        status_by_pr_id: dict[int, PullRequestStatus] = {}
        mergeable_state_by_pr_id: dict[int, PullRequestMergeableState | None] = {}
        for pull_request in pull_requests:
            status, mergeable_state = _get_pull_request_state(
                pull_request, repositories_by_id.get(pull_request.repository_id)
            )
            status_by_pr_id[pull_request.id] = status
            mergeable_state_by_pr_id[pull_request.id] = mergeable_state

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
                    mergeable_state_by_pr_id=mergeable_state_by_pr_id,
                ),
            ),
        )

        response: GroupPullRequestsResponse = {"pullRequests": pull_request_responses}

        return Response(response)
