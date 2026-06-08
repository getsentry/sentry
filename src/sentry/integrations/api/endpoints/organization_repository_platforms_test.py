from __future__ import annotations

import logging
import time
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

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
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import metrics

logger = logging.getLogger(__name__)

# Metric namespace for the candidate (tree-based) detector. Kept separate from
# the live single-platform detector's `.single.*` metrics so the two can be
# compared and this measurement removed/relocated cleanly at cutover.
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

        # Measurement-only: no body. A top-level list would trip Sentry's
        # MissingPaginationError guard, so return 204 No Content instead.
        return Response(status=204)

    def _measure_tree(self, client: GitHubApiClient, repo: Repository) -> None:
        """Fetch the full git tree once and emit structural metrics.

        Uses the ``HEAD`` ref so a single ``git/trees`` call suffices (no branch
        resolution). The client's ``get_tree`` helper drops the ``truncated``
        flag, so we call ``client.get`` directly to keep ``truncated`` and the
        per-entry ``size``.
        """
        start_time = time.monotonic()
        try:
            response = client.get(
                f"/repos/{repo.name}/git/trees/HEAD",
                params={"recursive": 1},
            )
        except ApiError:
            # Includes empty repos (409). Mirror the live path: log and bail
            # without emitting a completion, so failures don't skew the metrics.
            logger.exception(
                "integrations.github.platform_detection_measurement_failed",
                extra={"repo_id": repo.id, "repo_name": repo.name},
            )
            return

        tree: list[dict[str, Any]] = response.get("tree", []) if isinstance(response, dict) else []
        is_truncated = bool(response.get("truncated")) if isinstance(response, dict) else False
        repo_size_bytes = sum(entry.get("size", 0) for entry in tree if entry.get("type") == "blob")

        metrics.timing(f"{_MULTI_METRICS_PREFIX}.duration", time.monotonic() - start_time)
        metrics.incr(
            f"{_MULTI_METRICS_PREFIX}.completed",
            tags={"is_truncated": "true" if is_truncated else "false"},
        )
        metrics.distribution(f"{_MULTI_METRICS_PREFIX}.tree.entry_count", len(tree))
        metrics.distribution(f"{_MULTI_METRICS_PREFIX}.repo_size_bytes", repo_size_bytes)
