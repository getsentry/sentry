from __future__ import annotations

import time
from typing import Any

import sentry_sdk
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import logger as sentry_logger

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.integrations.api.bases.organization_repository import (
    OrganizationRepositoryEndpoint,
)
from sentry.integrations.github.client import GitHubApiClient
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiConflictError

# Metric namespace for the candidate (tree-based) detector.
_MULTI_METRICS_PREFIX = "onboarding-scm.platform_detection.multi"


@cell_silo_endpoint
class OrganizationRepositoryPlatformsTestEndpoint(OrganizationRepositoryEndpoint):
    """Measurement-only endpoint for the tree-based detector.

    Fetches the repository git tree in a single call and emits structural
    metrics (`onboarding-scm.platform_detection.multi.*`). It returns 204 No
    Content and has no effect on the live detector; the frontend fires it
    fire-and-forget alongside the real detection request.
    """

    owner = ApiOwner.INTEGRATION_PLATFORM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization: Organization, repo: Repository) -> Response:
        if not features.has(
            "organizations:integrations-github-platform-detection",
            organization,
            actor=request.user,
        ):
            return Response(status=404)

        if (
            not repo.integration_id
            or repo.provider != f"integrations:{IntegrationProviderSlug.GITHUB}"
        ):
            return Response(
                {"detail": "Platform detection is only supported for GitHub repositories."},
                status=400,
            )

        integration = integration_service.get_integration(integration_id=repo.integration_id)
        if integration is None:
            return Response({"detail": "GitHub integration not found."}, status=400)

        org_integration = integration_service.get_organization_integration(
            integration_id=repo.integration_id, organization_id=organization.id
        )
        if org_integration is None:
            return Response(
                {"detail": "GitHub integration is not configured for this organization."},
                status=400,
            )

        client = GitHubApiClient(integration=integration, org_integration_id=org_integration.id)

        self._measure_tree(client, repo)

        # Measurement-only: no body.
        return Response(status=204)

    def _measure_tree(self, client: GitHubApiClient, repo: Repository) -> None:
        """Fetch the full git tree once and emit structural metrics.

        Uses the ``HEAD`` ref so a single ``git/trees`` call suffices (no branch
        resolution). The client's ``get_tree`` helper drops the ``truncated``
        flag, so we call ``client.get`` directly to keep ``truncated`` and the
        per-entry ``size`` for now.
        """
        start_time = time.monotonic()
        try:
            response = client.get(
                f"/repos/{repo.name}/git/trees/HEAD",
                params={"recursive": 1},
            )

            tree: list[dict[str, Any]] = (
                response.get("tree", []) if isinstance(response, dict) else []
            )
            is_truncated = bool(response.get("truncated")) if isinstance(response, dict) else False
            repo_size_bytes = sum(
                entry.get("size", 0) for entry in tree if entry.get("type") == "blob"
            )

            sentry_sdk.metrics.distribution(
                f"{_MULTI_METRICS_PREFIX}.duration",
                (time.monotonic() - start_time) * 1000,
                unit="millisecond",
            )
            sentry_sdk.metrics.count(
                f"{_MULTI_METRICS_PREFIX}.completed",
                1,
                attributes={"is_truncated": is_truncated},
            )
            sentry_sdk.metrics.distribution(f"{_MULTI_METRICS_PREFIX}.tree.entry_count", len(tree))
            sentry_sdk.metrics.distribution(
                f"{_MULTI_METRICS_PREFIX}.repo_size_bytes",
                repo_size_bytes,
                unit="byte",
            )
        except Exception as e:
            # Empty repositories return a 409 (ApiConflictError) — an expected
            # measurement failure, so log only. Surface anything else as an issue.
            sentry_logger.warning(
                f"{_MULTI_METRICS_PREFIX}.failed",
                attributes={"repo_id": repo.id, "repo_name": repo.name},
            )
            if not isinstance(e, ApiConflictError):
                sentry_sdk.capture_exception()
