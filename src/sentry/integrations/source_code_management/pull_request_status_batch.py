from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping, Sequence

from sentry.api.serializers.models.pullrequest import PullRequestStatus
from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.status_check import (
    PullRequestStatusClient,
    PullRequestStatusRequest,
    PullRequestStatusResult,
)
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository

logger = logging.getLogger(__name__)


def get_pull_request_repo_name(repository: Repository) -> str:
    config_name = repository.config.get("name")
    if isinstance(config_name, str) and config_name:
        return config_name
    return repository.name


def get_provider_installation(
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


def get_checks_and_review(
    pull_requests: Sequence[PullRequest],
    repositories_by_id: Mapping[int, Repository],
    lifecycle_status_by_pr_id: Mapping[int, PullRequestStatus | None],
    *,
    include_files: bool = False,
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
            or lifecycle_status_by_pr_id.get(pull_request.id) not in ("open", "draft")
        ):
            continue

        try:
            int(pull_request.key)
        except (TypeError, ValueError):
            continue

        request = PullRequestStatusRequest(
            repo=get_pull_request_repo_name(repository),
            pull_number=pull_request.key,
            include_files=include_files,
        )
        requests_by_integration_id[repository.integration_id].append(
            (pull_request, repository, request)
        )

    results_by_pr_id: dict[int, PullRequestStatusResult] = {}
    for integration_id, request_items in requests_by_integration_id.items():
        representative_pull_request, representative_repository, _ = request_items[0]
        try:
            installation = get_provider_installation(
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
                "pull_request_status_batch.fetch_failed",
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
