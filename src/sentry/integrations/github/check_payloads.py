"""Reading the ``pull_requests`` list on GitHub check payloads.

GitHub lists a PR on a ``check_run``/``check_suite`` whenever the two share a head
sha, which includes PRs based in *other* repositories: a fork syncing from upstream
has its head here, so it matches every default-branch check in this repo.

Every consumer has to decide which entries are the webhook's own. Keeping that in
one place is what lets the control parser reason about the whole set at once — it
is the only reader that sees a payload before it is stored, and it cannot be more
permissive than the consumers downstream of it.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.utils.safe import get_path


def pull_request_base_repo_id(ref: Any) -> Any | None:
    """``base.repo.id`` of one ``pull_requests`` entry, or None.

    Tolerates junk at any level: the control parser reads these before the body has
    been signature-verified.
    """
    return get_path(ref, "base", "repo", "id")


def is_own_repo_pull_request(base_repo_id: Any | None, repo_id: Any | None) -> bool:
    """Whether a ``pull_requests`` entry is based in ``repo_id``.

    Compared as strings so callers can pass the payload's integer ``repository.id``
    or a ``Repository.external_id``, which holds the same value as text.

    An entry with no base repo is not ours. GitHub always sends ``base.repo``, so
    this is not a shape a live payload takes; treating it as ours would mean
    guessing. For the consumer resolving a repo-scoped ``number`` the guess is
    unsafe outright — numbers repeat across repositories — and a consumer resolving
    by global id gains nothing from a different answer to a case that does not
    occur, so they share this one.
    """
    if base_repo_id is None or repo_id is None:
        return False
    return str(base_repo_id) == str(repo_id)


def references_own_repo_pull_request(event: Mapping[str, Any], container_key: str) -> bool:
    """Whether a check payload references a pull request based in its own repo.

    ``container_key`` is the payload member holding the list, named after the event
    itself (``check_run`` / ``check_suite``).

    A False drops the payload, so it must never be False for one a consumer would
    act on. Erring True only costs a forwarded no-op.
    """
    repo_id = get_path(event, "repository", "id")
    if repo_id is None:
        return False

    refs = get_path(event, container_key, "pull_requests")
    if not isinstance(refs, list):
        return False

    return any(is_own_repo_pull_request(pull_request_base_repo_id(ref), repo_id) for ref in refs)
