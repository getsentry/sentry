"""Uniform "which Autofix run owns this pull request" resolution for SCM listeners.

Every PR-iteration listener needs the same thing — the Seer run behind a pull
request — but each SCM event describes its PR differently. ``check_suite``
carries the provider's global numeric PR id outright and goes straight to
:func:`get_run_state_for_pr_id`. ``issue_comment`` (the ``@sentry`` mention path)
and ``pull_request_review`` carry only a repo-scoped number and reach the same
lookup through :func:`resolve_pr_id`: GitHub's ``issue.pull_request`` object is
five URL/timestamp fields with no id in it, and the normalized review event's
``pull_request_id`` is the number the REST path uses rather than the id its name
suggests.

The two steps stay separate rather than collapsing into one call because every
caller wants the id even when there is no run: it is what the ``no_run`` log
lines are searched by, and a combined helper could only return it by returning
something on the failure path.

**Why the provider round-trip lives here.** Both number-carrying listeners
recover the id the same way — one ``get_pull_request`` — so that call sits
inside :func:`resolve_pr_id` rather than being written out per call site, where
it was duplicated verbatim. Its failures stay the caller's: ``ApiError`` propagates
untouched, so each task keeps reporting them under its own log key.

Two caches sit under this, and they cache opposite halves for opposite reasons:

* ``pr_id_cache`` caches *positives*, because number -> id can never become
  wrong. Its TTL is a memory budget rather than an invalidation — see
  ``PR_ID_CACHE_TTL_OPTION`` — so an expired entry costs a REST call, never a
  wrong id.
* This module caches only *negatives*, for the same reason and just as long.
  See below.

**Why run state is never cached.** :class:`SeerRunState` is live, mutable state —
``status``, ``updated_at``, ``blocks``, and the ``repo_pr_states`` that downstream
staleness checks compare head shas against. Serving a stale copy would mean
enqueueing feedback against a head the run has already moved past, which is
exactly the failure the staleness checks exist to prevent. So a run that exists
is always fetched fresh; only its *absence* is remembered.

**Why the negative TTL is long.** Every negative this module stores is
permanently true in practice, so it is held for a day rather than re-derived.
The two that dominate are "this PR has no Autofix run at all" — every push to
every non-Autofix PR in an installed repo — and "the run belongs to another
organization", which is what a region that does not own the session sees on
every webhook GitHub fans out to it. Neither answer can change: Autofix creates
the run before it creates the PR, so a PR cannot acquire its first run after we
have already looked.

The one answer that could go stale is a 404 served while Seer's PR -> run row is
still uncommitted. Seer inserts it immediately after the GitHub API returns the
created PR (``create_pr_step.py``), and every caller here is a webhook about a
PR that already exists — so reaching that window would mean a ``check_suite``
whose ``pull_requests[]`` is already populated (the PR exists) racing through
GitHub's delivery queue and ours inside the few lines between that API response
and the insert. It is not a window a webhook can realistically land in.

What would invalidate this is a future path that attaches a run to a PR that
already existed when we first looked. If one appears, ``result:cached_missing``
on the lookup metric is where it will show up first, and the fix is to shorten
this or to have that path delete the key.

**Why the negative key is organization-scoped.** Seer resolves the run from
``(provider, pr_id)`` globally and only then checks the caller's organization,
returning 404 when it belongs to someone else. A negative therefore means "not
for *this* organization", not "not for anyone" — storing it unscoped would poison
the lookup for the organization that does own the run.

**Why the provider is a parameter, but callers pin it.** The provider is part of
the identity of everything keyed below, so this module takes it explicitly rather
than assuming one: pass ``integrations:github_enterprise`` and each layer does the
right thing on its own. ``pr_id_cache`` declines to store it — GHE repo external
ids are unique per instance, not globally — so the caller keeps paying the REST
call it already paid, and the negative key below stays distinct from github.com's.

Callers do not thread a runtime provider in, though. PR iteration is github.com
only and every listener turns anything else away at its entry point, so they pass
``PR_ITERATION_PROVIDER`` directly. That keeps the one supported-provider decision
at the entry points instead of spread across the resolve helpers, while leaving
this module honest if another provider is ever admitted.
"""

from __future__ import annotations

import logging
from functools import partial
from typing import Literal

from sentry import options
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.source_code_management.pr_id_cache import get_or_fetch_pr_id
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.agent.client_utils import get_agent_state_from_pr_id
from sentry.seer.models import SeerApiError
from sentry.utils import metrics
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)

_METRICS_KEY = "autofix.pr_iteration.run_resolution"

# Bump when the key layout changes; stale entries are then never read again and
# age out on their own.
_CACHE_KEY_VERSION = 1

# The answers stored under this cannot become wrong -- see the module docstring
# -- so it is a memory budget, not an invalidation, exactly like the PR-id cache
# it sits next to. Both default to a day, and the number for each lives with its
# registration in ``sentry.options.defaults`` rather than being mirrored here.
#
# The argument for a day rests on a race being unreachable, and the cost of being
# wrong about that is a PR that stays dark for a day -- so the number is
# reachable without a deploy, and so is switching it off entirely.
NO_RUN_CACHE_TTL_OPTION = "autofix.pr-iteration.no-run-cache-ttl"

_NO_RUN_SENTINEL = 1

# Which listener a lookup came from. Bounded on purpose: it is a metrics tag, and
# the whole point is to be able to split hit rates by path without unbounded
# cardinality.
Caller = Literal["mention", "review", "check_suite"]


def _incr_lookup(caller: Caller, outcome: str) -> None:
    metrics.incr(f"{_METRICS_KEY}.lookup", tags={"caller": caller, "result": outcome})


def _no_run_cache_key(*, provider: str, pr_id: int, organization_id: int) -> str:
    return f"autofix:pr-iteration:no-run:{_CACHE_KEY_VERSION}:{provider}:{pr_id}:{organization_id}"


def _cache_ttl() -> int | None:
    """Seconds to remember an absence, or ``None`` to remember nothing.

    Zero is the off switch. Turning it off costs a Seer RPC per lookup -- the
    traffic this module was written to remove -- and buys back the one thing the
    long TTL gives up: a PR that acquires a run after we looked is picked up on
    the next webhook instead of a day later.

    Anything that is not a usable lifetime reads as off -- see the matching
    helper in ``pr_id_cache``, which explains why a negative has to be handled
    rather than declared impossible.
    """
    ttl = options.get(NO_RUN_CACHE_TTL_OPTION)
    return ttl if ttl > 0 else None


def _is_known_missing(*, provider: str, pr_id: int, organization_id: int) -> bool:
    """Whether this org has already been told there is no run for this PR."""
    if _cache_ttl() is None:
        return False

    try:
        return (
            cache.get(
                _no_run_cache_key(provider=provider, pr_id=pr_id, organization_id=organization_id)
            )
            is not None
        )
    except Exception:
        # A cache we cannot read is a cache miss: fall through and ask Seer.
        logger.exception(
            "autofix.pr_iteration.run_resolution.no_run_cache_get_failed",
            extra={"organization_id": organization_id, "pr_id": pr_id},
        )
        return False


def _mark_missing(*, provider: str, pr_id: int, organization_id: int) -> None:
    """Remember that this org has no run for this PR."""
    ttl = _cache_ttl()
    if ttl is None:
        return

    try:
        cache.set(
            _no_run_cache_key(provider=provider, pr_id=pr_id, organization_id=organization_id),
            _NO_RUN_SENTINEL,
            ttl,
        )
    except Exception:
        # Losing a negative only costs an RPC next time round.
        logger.exception(
            "autofix.pr_iteration.run_resolution.no_run_cache_set_failed",
            extra={"organization_id": organization_id, "pr_id": pr_id},
        )


def resolve_pr_id(
    *,
    provider: str | None,
    organization_id: int,
    integration: RpcIntegration,
    repo_external_id: str | None,
    repo_name: str,
    pr_number: int,
    caller: Caller,
) -> int | None:
    """The provider's global PR id for a repo-scoped ``pr_number``.

    Reads the immutable number -> id cache and only pays the provider round-trip
    on a miss. That round-trip's exceptions propagate untouched, so callers keep
    their existing error handling around this call.

    ``repo_external_id`` keys the cache -- see
    :mod:`sentry.integrations.source_code_management.pr_id_cache` for why the key
    is the repo's external id and never its name -- while ``repo_name`` and the
    ``integration`` are what a miss is paid with.

    The SCM client is built here rather than handed in so that it is built only
    on a miss: the cache is warm for almost every event, and the review path has
    no other use for a client at all.

    ``caller`` splits the resulting metric by listener. Without it a listener
    that quietly stopped hitting the cache would be invisible: the id cache's own
    counter sums every path into one number.
    """

    def fetch() -> int | None:
        # Only reached on a cache miss. Runs inside async tasks, where the PR may
        # have been deleted or made private, or GitHub may simply fail, between
        # webhook receipt and execution -- so a missing ``id`` is ``None`` rather
        # than a KeyError, and ``ApiError`` is left to the caller.
        client = integration.get_installation(organization_id=organization_id).get_client()
        pull_request = client.get_pull_request(repo_name, str(pr_number))
        pr_id: int | None = pull_request.get("id")
        return pr_id

    pr_id = get_or_fetch_pr_id(
        provider=provider,
        repo_external_id=repo_external_id,
        pr_number=pr_number,
        fetch=fetch,
    )

    metrics.incr(
        f"{_METRICS_KEY}.resolve",
        tags={"caller": caller, "result": "resolved" if pr_id is not None else "no_pr_id"},
    )
    return pr_id


def get_run_state_for_pr_id(
    *, organization_id: int, provider: str, pr_id: int, caller: Caller
) -> SeerRunState | None:
    """The Seer run state for ``pr_id`` as seen by ``organization_id``.

    Returns ``None`` when this organization has no run for the PR, which covers
    both "no run exists" and "the run belongs to another organization" -- Seer
    reports the second as a 404 and the caller cannot tell them apart anyway.

    Only that absence is remembered, and only for as long as
    :data:`NO_RUN_CACHE_TTL_OPTION` says -- zero remembers nothing. Transport
    failures and Seer errors other than 404 are *not* remembered: they say nothing
    about whether a run exists, and caching them would turn a blip into a day of
    blindness. They propagate as :class:`SeerApiError` so callers keep reporting
    them.
    """
    incr = partial(_incr_lookup, caller)

    if _is_known_missing(provider=provider, pr_id=pr_id, organization_id=organization_id):
        incr("cached_missing")
        return None

    try:
        state = get_agent_state_from_pr_id(organization_id, provider, pr_id)
    except SeerApiError as e:
        if e.status == 404:
            # The run exists but is owned elsewhere, or the run id resolved to a
            # state this org cannot read. Either way there is nothing here.
            _mark_missing(provider=provider, pr_id=pr_id, organization_id=organization_id)
            incr("not_found")
            return None

        incr("error")
        raise

    if state is None:
        _mark_missing(provider=provider, pr_id=pr_id, organization_id=organization_id)
        incr("no_run")
        return None

    incr("found")
    return state
