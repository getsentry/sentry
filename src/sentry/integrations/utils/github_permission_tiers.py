"""Which Sentry features a GitHub App installation loses when it is missing permissions.

Every permission the app asks for arrived with a feature, and an installation
sits at whichever version of the app it last accepted. Upgrades only ever raised
requirements, so the tiers below are totally ordered by ``PermissionTier.order``
and an installation should be a point on that order: satisfying one tier implies
satisfying every lower one. An install is described by how far up it got, and
the copy to show names the tiers above that point.

``order`` is what encodes the chain, not the declaration order of ``TIERS``.
A new feature gets the next number up; the numbers are spaced by one only
because nothing has ever needed to slot in between.

Tiers are keyed on scope *and* level, not scope alone. Several scopes were
already held at ``read`` long before a later feature raised them to ``write``:
``contents:read`` predates Seer entirely while ``contents:write`` is what lets
Autofix push a branch, and the same split applies to ``pull_requests``. A tier
declares only the raise it introduced; everything it inherits belongs to the
lower tiers returned alongside it.

``BASELINE_TIER`` sits at the bottom as the catchall. It declares no scopes and
instead speaks for whatever the app requires that no other tier claims, which is
both the permissions predating the history we have and any scope a future app
version starts requiring before someone adds a tier for it.

A set that is not a point on the order -- satisfying a tier while falling short
of a lower one -- is a combination we do not understand, so it is logged and
treated as nothing to say rather than guessed at. That is also what a missing
tier declaration looks like from here, which is the point: drift surfaces as a
warning instead of as confident but wrong copy.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass, field

from sentry.integrations.utils.github_permissions import (
    GITHUB_APP_REQUIRED_PERMISSIONS,
    PERMISSION_LEVELS,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PermissionTier:
    key: str
    # Position on the chain. Higher is newer, and satisfying this tier means
    # satisfying every tier below it.
    order: int
    name: str
    description: str
    # The permission raise this tier introduced, as scope -> minimum level. Not
    # the full set the feature needs: the rest came with lower tiers. Empty on
    # BASELINE_TIER, whose requirements are derived by exclusion instead.
    introduced: Mapping[str, str] = field(default_factory=dict)


BASELINE_TIER = PermissionTier(
    key="baseline",
    order=0,
    name="Various earlier features",
    description=(
        "Linking to Sentry Issues, Suspect Commits, and keeping repository data up to date."
    ),
)

PR_COMMENTS_TIER = PermissionTier(
    key="pull_request_comments",
    order=1,
    name="Pull request comments",
    description="Comments on your pull requests to link them to the Sentry issues they caused.",
    introduced={"pull_requests": "write"},
)

CODE_REVIEW_TIER = PermissionTier(
    key="code_review",
    order=2,
    name="Seer Code Review",
    description="Seer Code Review: Reviews your pull requests and reports the results as a check run.",
    introduced={"checks": "write", "statuses": "write"},
)

AUTOFIX_PULL_REQUESTS_TIER = PermissionTier(
    key="autofix_pull_requests",
    order=3,
    name="Autofix pull requests",
    description="Seer Autofix: Pushes a branch and opens a pull request with a fix for an issue.",
    introduced={"contents": "write"},
)

PR_ITERATION_TIER = PermissionTier(
    key="pr_iteration",
    order=4,
    name="Pull request iteration",
    description=(
        "Seer PR Iteration: Reads GitHub Actions logs and re-run jobs, so Seer Autofix "
        "can get a pull request it opened to a passing build."
    ),
    introduced={
        "actions": "write",
        "code_quality": "read",
        "security_events": "read",
    },
)

TIERS: tuple[PermissionTier, ...] = tuple(
    sorted(
        (
            BASELINE_TIER,
            PR_COMMENTS_TIER,
            CODE_REVIEW_TIER,
            AUTOFIX_PULL_REQUESTS_TIER,
            PR_ITERATION_TIER,
        ),
        key=lambda tier: tier.order,
        reverse=True,
    )
)


def _level(level: str | None) -> int:
    return PERMISSION_LEVELS.get(level or "", 0)


def _falls_short(permissions: Mapping[str, str], requirements: Mapping[str, str]) -> bool:
    return any(
        _level(permissions.get(scope)) < _level(level) for scope, level in requirements.items()
    )


def _baseline_tier_reqs(required_permissions: Mapping[str, str]) -> dict[str, str]:
    """The requirements in ``required_permissions`` that no tier claims a scope for.

    These are what ``BASELINE_TIER`` speaks for. A scope showing up here that we
    did not expect to means the app started requiring something new and nobody
    added a tier for it, so users are being asked to accept a permission we
    cannot name a feature for.
    """
    claimed: dict[str, int] = {}
    for tier in TIERS:
        for scope, level in tier.introduced.items():
            claimed[scope] = max(claimed.get(scope, 0), _level(level))

    return {
        scope: level
        for scope, level in required_permissions.items()
        if claimed.get(scope, 0) < _level(level)
    }


def _requirements(
    tier: PermissionTier, required_permissions: Mapping[str, str]
) -> Mapping[str, str]:
    if tier is BASELINE_TIER:
        return _baseline_tier_reqs(required_permissions)

    return tier.introduced


def get_permission_tiers(
    permissions: Mapping[str, str], required_permissions: Mapping[str, str]
) -> list[PermissionTier]:
    """Tiers an install holding ``permissions`` falls short of, highest order first.

    ``permissions`` is the installation's own scope -> level map as GitHub
    reports it in ``Integration.metadata["permissions"]``; ``required_permissions``
    is what the current app version asks for. Most callers want
    ``get_missing_permission_tiers``, which passes ``GITHUB_APP_REQUIRED_PERMISSIONS``.

    Empty when the install is current. When its permissions are not a point on
    the order we cannot trust the state, so rather than guess we log it and
    conservatively assume every tier is missing, returning them all. That covers
    both an inconsistent set and falling short of ``BASELINE_TIER``, whose
    permissions predate everything. Scopes beyond what any tier asks for are
    ignored. A level we do not recognise counts as not held.
    """
    behind = [
        tier
        for tier in TIERS
        if _falls_short(permissions, _requirements(tier, required_permissions))
    ]
    if not behind:
        return []

    if BASELINE_TIER in behind:
        logger.warning(
            "github_permission_tiers.short_of_baseline",
            extra={
                "expected_permissions": dict(_baseline_tier_reqs(required_permissions)),
                "permissions": dict(permissions),
            },
        )
        return list(TIERS)

    lowest = min(tier.order for tier in behind)
    expected = {tier.order for tier in TIERS if tier.order >= lowest}
    if {tier.order for tier in behind} != expected:
        logger.warning(
            "github_permission_tiers.inconsistent_permissions",
            extra={
                "behind_tiers": [tier.key for tier in behind],
                "permissions": dict(permissions),
            },
        )
        return list(TIERS)

    return behind


def get_missing_permission_tiers(permissions: Mapping[str, str]) -> list[PermissionTier]:
    """The feature tiers an installation holding ``permissions`` falls short of.

    Feed in the install's own scope -> level map (from
    ``Integration.metadata["permissions"]``) and get back the tiers it is missing,
    highest order first. A non-empty result *is* the "missing permissions" signal:
    each tier names a feature that stops working, and an install with everything
    the app requires comes back empty. Thin wrapper over ``get_permission_tiers``
    that compares against ``GITHUB_APP_REQUIRED_PERMISSIONS``.
    """
    return get_permission_tiers(permissions, GITHUB_APP_REQUIRED_PERMISSIONS)
