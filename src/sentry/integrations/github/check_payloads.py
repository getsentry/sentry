"""Reading the ``pull_requests`` list on GitHub check payloads.

GitHub lists a PR on a ``check_run``/``check_suite`` whenever the two share a head
sha, which includes PRs based in *other* repositories: a fork syncing from upstream
has its head here, so it matches every default-branch check in this repo.

Every consumer has to decide which entries are the webhook's own, and all of them
must decide it the same way — the control parser drops payloads referencing no
own-repo PR before they are stored (``ActionFilter.own_repo_pr_actions``), so a
consumer reading the list more permissively silently stops receiving those events.
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

    An entry with no base repo is not ours: numbers repeat across repositories, so
    placing one here could attribute another repo's PR to this one. Consumers that
    resolve by global id could place it, but follow the same rule so they all act
    on the set the control parser preserves.
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
