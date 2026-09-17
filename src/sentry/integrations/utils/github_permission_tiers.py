"""Which Sentry features a GitHub App installation loses when it is missing permissions.

Every permission the app asks for arrived with a feature, and an installation
sits at whichever version of the app it last accepted. Upgrades only ever raised
requirements, so the tiers below are totally ordered by ``PermissionTier.order``
and an installation should be a point on that order: satisfying one tier implies
satisfying every lower one. An install is described by how far up it got, and
the copy to show describes the tiers above that point.

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

We parse permission levels once into numbers and log when we get an
unexpected level.

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
    PermissionLevel,
    parse_github_app_permissions,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PermissionTier:
    key: str
    # Position on the chain. Higher is newer, and satisfying this tier means
    # satisfying every tier below it.
    order: int
    description: str
    # The permission raise this tier introduced, as scope -> minimum level. Not
    # the full set the feature needs: the rest came with lower tiers. Empty on
    # BASELINE_TIER, whose requirements are derived by exclusion instead.
    introduced: Mapping[str, PermissionLevel] = field(default_factory=dict)


BASELINE_TIER = PermissionTier(
    key="baseline",
    order=0,
    description=(
        "Including issue linking, commit tracking, and keeping repository data up to date."
    ),
)

PR_COMMENTS_TIER = PermissionTier(
    key="pull_request_comments",
    order=1,
    description="Comment on pull requests to link them to the Sentry issues they caused.",
    introduced={"pull_requests": PermissionLevel.WRITE},
)

CODE_REVIEW_TIER = PermissionTier(
    key="code_review",
    order=2,
    description="Review your pull requests and report the result as a check run.",
    introduced={"checks": PermissionLevel.WRITE, "statuses": PermissionLevel.WRITE},
)

AUTOFIX_PULL_REQUESTS_TIER = PermissionTier(
    key="autofix_pull_requests",
    order=3,
    description="Push a branch and open a pull request with a fix for an issue.",
    introduced={"contents": PermissionLevel.WRITE},
)

PR_ITERATION_TIER = PermissionTier(
    key="pr_iteration",
    order=4,
    description=(
        "Read GitHub Actions logs and re-run jobs, so Seer can get a pull "
        "request it opened to a passing build."
    ),
    introduced={
        "actions": PermissionLevel.WRITE,
        "code_quality": PermissionLevel.READ,
        "security_events": PermissionLevel.READ,
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


def _names(levels: Mapping[str, PermissionLevel]) -> dict[str, str]:
    """Levels as GitHub words, for a log a person has to read."""
    return {scope: level.name.lower() for scope, level in levels.items()}


def _falls_short(
    levels: Mapping[str, PermissionLevel], requirements: Mapping[str, PermissionLevel]
) -> bool:
    return any(
        (held := levels.get(scope)) is None or held < level for scope, level in requirements.items()
    )


def _baseline_tier_reqs(
    required_levels: Mapping[str, PermissionLevel],
) -> dict[str, PermissionLevel]:
    """The requirements in ``required_levels`` that no tier claims a scope for.

    These are what ``BASELINE_TIER`` speaks for. A scope showing up here that we
    did not expect to means the app started requiring something new and nobody
    added a tier for it, so users are being asked to accept a permission we
    cannot name a feature for.
    """
    claimed: dict[str, PermissionLevel] = {}
    for tier in TIERS:
        for scope, level in tier.introduced.items():
            claimed[scope] = max(claimed.get(scope, PermissionLevel.READ), level)

    return {
        scope: level
        for scope, level in required_levels.items()
        if scope not in claimed or claimed[scope] < level
    }


def _requirements(
    tier: PermissionTier, required_levels: Mapping[str, PermissionLevel]
) -> Mapping[str, PermissionLevel]:
    if tier is BASELINE_TIER:
        return _baseline_tier_reqs(required_levels)

    return tier.introduced


def get_permission_tiers(
    permissions: Mapping[str, str], required_permissions: Mapping[str, str]
) -> list[PermissionTier]:
    """Tiers an install holding ``permissions`` falls short of, highest order first.

    ``permissions`` is the installation's own scope -> level map as GitHub
    reports it in ``Integration.metadata["permissions"]``; ``required_permissions``
    is what the current app version asks for, from
    ``GITHUB_APP_LATEST_PERMISSIONS``.

    Empty when the install is current. When its permissions are not a point on
    the order we cannot trust the state, so rather than guess we log it and
    conservatively assume every tier is missing, returning them all. That covers
    both an inconsistent set and falling short of ``BASELINE_TIER``, whose
    permissions predate everything. Scopes beyond what any tier asks for are
    ignored. A level we do not recognise counts as not held.
    """
    levels = parse_github_app_permissions(permissions, source="installation").levels
    required_levels = parse_github_app_permissions(
        required_permissions, source="required_permissions"
    ).levels

    behind = [tier for tier in TIERS if _falls_short(levels, _requirements(tier, required_levels))]
    if not behind:
        return []

    if BASELINE_TIER in behind:
        logger.warning(
            "github_permission_tiers.short_of_baseline",
            extra={
                "expected_levels": _names(_baseline_tier_reqs(required_levels)),
                "levels": _names(levels),
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
                "levels": _names(levels),
            },
        )
        return list(TIERS)

    return behind
