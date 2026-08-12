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
# lookup. We are starting deliberately short rather than guessing high, because
# we do not yet know how long a PR keeps being touched. Widen it once
# ``integrations.source_code_management.pr_id_cache.get``, split by its
# ``result`` tag, shows the misses are entries that expired rather than PRs seen
# for the first time.
PR_ID_CACHE_TTL = 24 * 60 * 60

# github.com, whose repo ids are unique across every repository GitHub knows
# about — which is what makes a key without any tenant scope safe. Every other
# provider, GitHub Enterprise included, is not cached; see the module docstring.
SUPPORTED_PROVIDER = f"integrations:{IntegrationProviderSlug.GITHUB.value}"


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
    ``SUPPORTED_PROVIDER``), and for a cache backend failure — all three mean
    "ask GitHub".
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

    key = _cache_key(provider, repo_external_id, pr_number)

    try:
        value = cache.get(key)
    except Exception:
        logger.exception("scm.pr_id_cache.get_failed", extra={"repo_external_id": repo_external_id})
        metrics.incr(f"{_METRICS_KEY}.get", tags={"result": "error"})
        return None

    # bool is an int subclass and would sail through an isinstance check.
    if not isinstance(value, int) or isinstance(value, bool):
        metrics.incr(f"{_METRICS_KEY}.get", tags={"result": "miss"})
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

    key = _cache_key(provider, repo_external_id, pr_number)

    try:
        cache.set(key, pr_id, PR_ID_CACHE_TTL)
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
