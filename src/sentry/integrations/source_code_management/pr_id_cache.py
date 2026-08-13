"""Cache of ``(GitHub repository, pull request number) -> GitHub pull request id``.

Some GitHub payloads carry only a repo-scoped PR *number* while the lookups
downstream are keyed on GitHub's global numeric PR *id*. The ``issue_comment``
event — the one behind ``@sentry`` mentions — is the case that motivated this
module: it describes the PR with URLs and a number only, so recovering the id
costs a REST round-trip on every mention.

The mapping is permanently immutable, which is what makes it cacheable at all:

* a PR number is never reused within a repository;
* a PR's global id never changes;
* repository transfers and renames preserve the repo id, the PR numbers and the
  PR ids.

So there is no invalidation path and none is needed. The TTL below is purely a
memory-versus-hit-rate tradeoff.

Four things about the key are deliberate:

**github.com is the only supported provider.** Not a limitation to lift later:
the key's uniqueness rests on ``repo_external_id`` being unique within
``provider``, and a self-hosted GitHub Enterprise instance hands out small,
per-instance repo ids, so repo id ``1`` names a different repository on every
host while the provider string is the same ``integrations:github_enterprise``
for all of them. Caching those would be a cross-host id mix-up. GHE shares
GitHub's webhook handlers, so it reaches this module and is turned away here
rather than at each call site; PR iteration does not support GHE either (see
``PR_ITERATION_PROVIDER`` in ``sentry.seer.autofix.pr_iteration.constants``).
Nothing is lost by that: this is a latency optimization, so a repo that is not
cached simply keeps paying the REST round-trip it already pays.

**It is keyed on GitHub's repo id, never on ``owner/repo``.** Repository names
are reusable — delete or rename a repo and someone else can take the name — so a
name-keyed entry can silently start pointing at a different repository's PR.
GitHub repo ids are never reused.

**A repo missing half of the key is skipped, and counted.**
``Repository.provider`` and ``Repository.external_id`` are both nullable
columns, so a caller holding a ``Repository`` cannot promise us either one. Such
a row has nothing that identifies it to GitHub, and keying on the empty value
would collide every such repo onto a single entry — so those lookups skip the
cache and keep paying the REST call. They are counted as ``result:unkeyable``,
tagged ``missing`` with the column at fault, rather than passed over silently:
if that counter is more than noise, the fix belongs upstream in whatever leaves
those columns unset, not here.

A *present but unsupported* provider is a different thing and is not counted —
GHE is working as designed, and metering it would bury the broken rows under
traffic that was never cacheable. So the checks run null-provider, then
unsupported-provider, then null-external-id: the last is reached only by repos
we would otherwise have cached, while a null provider is counted wherever it
comes from.

**No organization appears in the key.** Not the GitHub org, which is already
subsumed by the globally unique repo id, and not the Sentry organization: the
value is a fact about GitHub, not about a tenant. One GitHub App installation
can be linked to several Sentry organizations (see
``resolve_check_suite_repositories`` in
``sentry.seer.autofix.pr_iteration.check_suites``), so an org-scoped key would
store N identical copies of one fact and miss on N-1 of them.
"""

from __future__ import annotations

import logging
from collections.abc import Callable

from sentry import options
from sentry.integrations.types import IntegrationProviderSlug
from sentry.utils import metrics
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)

_METRICS_KEY = "integrations.source_code_management.pr_id_cache"

# Bump when the key layout or the stored value's encoding changes; old entries
# are then simply never read again and age out on their own.
_CACHE_KEY_VERSION = 1

# 1 day. There is no correctness reason to expire an entry — the mapping it holds
# can never become wrong — so the only question this number answers is how much
# cache memory we are willing to spend to keep entries around for a repeat
# lookup. Note that every warm re-``set``s the key and pushes the deadline out,
# so what expires is not a PR first seen a day ago but one that has been silent
# for a day: ``sentry.integrations.github.webhook`` renews it on every
# ``pull_request`` event and ``sentry.seer.autofix.pr_iteration.check_suites`` on
# every ``check_suite``. We are starting deliberately short rather than guessing
# high, because we do not yet know how long a PR stays quiet before someone
# mentions ``@sentry`` on it.
#
# ``integrations.source_code_management.pr_id_cache.get`` will not tell you
# whether widening this would pay, whichever way you split it: ``cache.get``
# returns ``None`` for an entry that expired and for one that was never stored
# alike, so ``result:miss`` folds the two together and no tag on it can take them
# apart after the fact. Deciding needs the two TTLs running at once — assign each
# key to an arm by a stable hash of the key itself, so an entry is always read
# under the arm that wrote it, tag the counter with the arm, and compare hit
# rates across what are then two identical populations.
#
# The number itself lives with the registration in ``sentry.options.defaults``,
# so it can be moved — or the cache switched off outright — without a deploy. It
# is deliberately not mirrored here: a module constant that the option overrides
# is a second source of truth that looks authoritative and changes nothing.
PR_ID_CACHE_TTL_OPTION = "integrations.pr-id-cache.ttl"

# github.com, whose repo ids are unique across every repository GitHub knows
# about — which is what makes a key without any tenant scope safe. Every other
# provider, GitHub Enterprise included, is not cached; see the module docstring.
SUPPORTED_PROVIDER = f"integrations:{IntegrationProviderSlug.GITHUB.value}"


def _cache_ttl() -> int | None:
    """Seconds to keep an entry, or ``None`` to bypass the cache entirely.

    Zero is the off switch, and it turns the cache off on *both* sides rather
    than storing entries nothing will read: a lookup skips the read and every
    caller goes back to paying the REST call it paid before this module existed.
    That is a latency regression and never a correctness one, which is what makes
    it safe to reach for from the automator mid-incident.

    The question asked of the option is "is this a usable lifetime?", not "is
    this zero": the options system has no way to declare a bound, so a negative
    is registerable and settable. Reading it as off keeps that misconfiguration
    equivalent to the off switch instead of handing the backend a write that is
    already expired.
    """
    ttl = options.get(PR_ID_CACHE_TTL_OPTION)
    return ttl if ttl > 0 else None


def _cache_key(provider: str, repo_external_id: str, pr_number: int) -> str:
    return f"scm:pr-id:{_CACHE_KEY_VERSION}:{provider}:{repo_external_id}:{pr_number}"


def get_cached_pr_id(
    *,
    provider: str | None,
    repo_external_id: str | None,
    pr_number: int,
) -> int | None:
    """The GitHub PR id previously stored for this repo + PR number, if any.

    Returns ``None`` for a miss, for an unkeyable/unsupported repo (anything but
    ``SUPPORTED_PROVIDER``), for a cache backend failure, and for a stored value
    this module would not have written — all four mean "ask GitHub".
    """

    if not provider:
        metrics.incr(f"{_METRICS_KEY}.get", tags={"result": "unkeyable", "missing": "provider"})
        return None

    if provider != SUPPORTED_PROVIDER:
        return None

    if not repo_external_id:
        metrics.incr(
            f"{_METRICS_KEY}.get", tags={"result": "unkeyable", "missing": "repo_external_id"}
        )
        return None

    # Last, so that the diagnostics above keep their meaning while the cache is
    # off: `unkeyable` reports rows with nothing to key on, which is an upstream
    # bug either way. `disabled` therefore counts exactly the lookups that would
    # otherwise have gone to the backend.
    if _cache_ttl() is None:
        metrics.incr(f"{_METRICS_KEY}.get", tags={"result": "disabled"})
        return None

    key = _cache_key(provider, repo_external_id, pr_number)

    try:
        value = cache.get(key)
    except Exception:
        logger.exception("scm.pr_id_cache.get_failed", extra={"repo_external_id": repo_external_id})
        metrics.incr(f"{_METRICS_KEY}.get", tags={"result": "error"})
        return None

    if value is None:
        metrics.incr(f"{_METRICS_KEY}.get", tags={"result": "miss"})
        return None

    # Counted apart from the miss it is indistinguishable from at the call site:
    # nothing here writes a non-int, so one turning up means the entry did not
    # come from `set_cached_pr_id` — a key collision, or an encoding change that
    # went out without the version bump above. Folded into `miss` it would read
    # as ordinary cold-cache traffic.
    #
    # bool is an int subclass and would sail through an isinstance check.
    if not isinstance(value, int) or isinstance(value, bool):
        metrics.incr(f"{_METRICS_KEY}.get", tags={"result": "invalid"})
        return None

    metrics.incr(f"{_METRICS_KEY}.get", tags={"result": "hit"})
    return value


def set_cached_pr_id(
    *,
    provider: str | None,
    repo_external_id: str | None,
    pr_number: int,
    pr_id: int,
) -> None:
    """Record ``pr_number -> pr_id`` for this repo.

    Never raises: callers are webhook handlers whose real work must not depend on
    the cache backend being reachable.
    """

    if not provider:
        metrics.incr(f"{_METRICS_KEY}.set", tags={"result": "unkeyable", "missing": "provider"})
        return

    if provider != SUPPORTED_PROVIDER:
        return

    if not repo_external_id:
        metrics.incr(
            f"{_METRICS_KEY}.set", tags={"result": "unkeyable", "missing": "repo_external_id"}
        )
        return

    # Both sides read the option, so switching it off stops new entries as well
    # as reads. Entries already stored are left to expire under the TTL they were
    # written with rather than being deleted.
    ttl = _cache_ttl()
    if ttl is None:
        metrics.incr(f"{_METRICS_KEY}.set", tags={"result": "disabled"})
        return

    key = _cache_key(provider, repo_external_id, pr_number)

    try:
        cache.set(key, pr_id, ttl)
    except Exception:
        logger.exception("scm.pr_id_cache.set_failed", extra={"repo_external_id": repo_external_id})
        metrics.incr(f"{_METRICS_KEY}.set", tags={"result": "error"})
        return

    metrics.incr(f"{_METRICS_KEY}.set", tags={"result": "stored"})


def get_or_fetch_pr_id(
    *,
    provider: str | None,
    repo_external_id: str | None,
    pr_number: int,
    fetch: Callable[[], int | None],
) -> int | None:
    """Read the PR id from cache, falling back to ``fetch`` on a miss.

    ``fetch`` is called on every miss and its exceptions propagate untouched, so
    callers keep whatever error handling they already had around it. An
    unsupported provider or an unkeyable repo is a permanent miss rather than a
    failure: those callers reach ``fetch`` the same as anyone else and simply
    never get an entry stored for them.

    A ``None`` from ``fetch`` is **not** cached. A missing id means lost
    installation access, a repo gone private, or a transient provider error —
    caching that would turn a recoverable state into a persistent one for the
    whole TTL.
    """

    cached = get_cached_pr_id(
        provider=provider, repo_external_id=repo_external_id, pr_number=pr_number
    )
    if cached is not None:
        return cached

    pr_id = fetch()
    if pr_id is None:
        return None

    set_cached_pr_id(
        provider=provider,
        repo_external_id=repo_external_id,
        pr_number=pr_number,
        pr_id=pr_id,
    )

    return pr_id
