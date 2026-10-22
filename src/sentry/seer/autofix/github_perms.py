from __future__ import annotations

import logging
from collections.abc import Collection
from dataclasses import dataclass

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.integrations.utils.github_permission_tiers import (
    PermissionTier,
    get_missing_permission_tiers,
)
from sentry.integrations.utils.github_permissions import (
    get_github_permissions_update_url,
    is_permissions_snapshot_stale,
)
from sentry.models.organization import Organization
from sentry.models.repository import Repository
from sentry.seer.autofix.constants import SEER_GITHUB_PROVIDERS

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class MissingGithubPermissions:
    integration: RpcIntegration
    # Feature tiers the installation falls short of, highest order first. Never
    # empty: an install with everything it needs is not reported as missing
    # anything. Their presence is the "missing permissions" signal; each tier
    # names a feature that stops working.
    missing_tiers: list[PermissionTier]
    # The Repository row this was resolved for, so callers can log an id
    # instead of the repo's full name.
    repository_id: int

    @property
    def installation_id(self) -> str:
        """GitHub App installation id (Integration.external_id)."""
        return str(self.integration.external_id)

    @property
    def installation_url(self) -> str | None:
        """Page where the user reviews and accepts the installation's updated
        permissions. Org-owned installs live under a different namespace than
        user-owned ones, so this branches on the account type. None when the
        install's account is unknown and the path can't be built."""
        return get_github_permissions_update_url(
            str(self.integration.external_id),
            self.integration.metadata.get("account_type"),
            self.integration.name,
        )


def get_missing_permissions_by_repo(
    organization: Organization, repo_names: Collection[str]
) -> dict[str, MissingGithubPermissions]:
    """Map each of `repo_names` whose GitHub App install is missing a feature
    tier to the tiers it is missing. Repos with a complete install, no active
    org-scoped GitHub repository row, no integration, or an install whose
    permissions we do not know are absent.
    """
    if not repo_names:
        return {}

    # Org-scoped so a run can only surface permissions for repos in its own org.
    repos = (
        Repository.objects.filter(
            organization_id=organization.id,
            provider__in=SEER_GITHUB_PROVIDERS,
            name__in=list(repo_names),
            status=ObjectStatus.ACTIVE,
        )
        .order_by("name", "integration_id")
        .values_list("name", "id", "integration_id")
    )

    missing_by_repo: dict[str, MissingGithubPermissions] = {}
    resolved: set[str] = set()
    for repo_name, repository_id, integration_id in repos:
        resolved.add(repo_name)

        if not isinstance(integration_id, int):
            _warn_unresolved(organization, "no_integration_id", repository_id=repository_id)
            continue

        integration = integration_service.get_integration(integration_id=integration_id)
        if integration is None:
            _warn_unresolved(
                organization,
                "integration_not_found",
                repository_id=repository_id,
                integration_id=integration_id,
            )
            continue

        integration = _with_fresh_permissions(organization, integration, repository_id)
        if integration is None:
            continue

        # None is not "holds nothing", it is "we never learned what this install
        # holds" -- token refresh writes whatever GitHub returned, including a
        # missing permissions payload. Checking it would report every tier as
        # missing and ask the user to grant permissions they may already have.
        permissions = integration.metadata.get("permissions")
        if permissions is None:
            _warn_unresolved(
                organization,
                "permissions_unknown",
                repository_id=repository_id,
                integration_id=integration_id,
            )
            continue

        missing_tiers = get_missing_permission_tiers(permissions)
        if missing_tiers:
            missing_by_repo[repo_name] = MissingGithubPermissions(
                integration=integration, missing_tiers=missing_tiers, repository_id=repository_id
            )

    for repo_name in set(repo_names) - resolved:
        _warn_unresolved(organization, "no_repository_row", scm_repo_full_name=repo_name)

    return missing_by_repo


def _with_fresh_permissions(
    organization: Organization, integration: RpcIntegration, repository_id: int
) -> RpcIntegration | None:
    """`integration` with a permissions snapshot recent enough to judge, or None.

    A snapshot older than the app's permissions change was read against the old
    required set, so it cannot say whether this install is missing anything now.
    Mint a fresh installation token and re-read instead of commenting off it.

    This is self-limiting rather than a per-call cost: the refresh rewrites
    ``last_refresh_at``, so an integration takes this path once and every later
    call short-circuits on the first line.

    None when the refresh fails or the snapshot is still stale afterwards. The
    caller reads that as "nothing missing", which is deliberate -- staying quiet
    beats telling someone to accept permissions we cannot confirm they lack.
    """
    if not is_permissions_snapshot_stale(integration.metadata):
        return integration

    try:
        refreshed = integration_service.refresh_github_permissions(
            integration_id=integration.id, organization_id=organization.id
        )
    except Exception:
        # Minting the token talks to GitHub, so this fails for reasons that have
        # nothing to do with permissions. Treat it as "cannot tell" rather than
        # letting a GitHub blip fail the task that called us.
        refreshed = None

    if refreshed is None or is_permissions_snapshot_stale(refreshed.metadata):
        _warn_unresolved(
            organization,
            "stale_permissions_snapshot",
            repository_id=repository_id,
            integration_id=integration.id,
            refreshed=refreshed is not None,
        )
        return None

    logger.info(
        "autofix.github_perms.permissions_refreshed",
        extra={
            "organization_id": organization.id,
            "integration_id": integration.id,
            "repository_id": repository_id,
        },
    )
    return refreshed


def _warn_unresolved(organization: Organization, reason: str, **fields: object) -> None:
    """A repo the run is working in that we cannot check permissions for.

    Warning, not info: the caller silently treats these as "nothing missing", so
    without a log a user never hearing about a permission they need looks
    identical to a healthy install.
    """
    logger.warning(
        "autofix.github_perms.repo_unresolved",
        extra={"organization_id": organization.id, "reason": reason, **fields},
    )
