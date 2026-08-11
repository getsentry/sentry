"""Reading the ``pull_requests`` list on GitHub check payloads.

GitHub attaches a pull request to a ``check_run`` or ``check_suite`` whenever the
two share a head sha (plus head branch, for suites). That includes pull requests
whose *base* is a different repository — a fork syncing from upstream has its head
here, so it matches every default-branch check in this repo while belonging to the
other one.

Every consumer of that list therefore has to decide which entries are the
webhook's own, and they all have to decide it the same way. The control parser
drops check payloads that reference no own-repo pull request before they are ever
stored (``ActionFilter.own_repo_pr_actions``), so a consumer reading the list more
permissively than this module would simply stop receiving those events, with
nothing to signal it.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from sentry.utils.safe import get_path


def pull_request_base_repo_id(ref: Any) -> Any | None:
    """The ``base.repo.id`` of one ``pull_requests`` entry, or None when absent.

    Tolerates a malformed entry: these payloads are read in the control parser
    before the body has been signature-verified, so any level may be missing or
    the wrong type.
    """
    return get_path(ref, "base", "repo", "id")


def is_own_repo_pull_request(base_repo_id: Any | None, repo_id: Any | None) -> bool:
    """Whether a ``pull_requests`` entry is a pull request based in ``repo_id``.

    Compared as strings so callers can pass either the payload's integer
    ``repository.id`` or a ``Repository.external_id``, which stores the same value
    as text.

    An entry with no base repo is **not** ours. It cannot be placed, and for the
    consumer resolving a repo-scoped ``number`` that is the only safe reading:
    numbers repeat across repositories, so treating an unplaceable entry as ours
    risks attributing another repo's pull request to this one. Consumers resolving
    by global pull request id could technically place it, but follow the same rule
    so that the set of entries every consumer acts on is identical to the set the
    control parser preserves.
    """
    if base_repo_id is None or repo_id is None:
        return False
    return str(base_repo_id) == str(repo_id)


def references_own_repo_pull_request(event: Mapping[str, Any], container_key: str) -> bool:
    """Whether a check payload references a pull request based in its own repo.

    ``container_key`` is the payload member holding the list, which is named after
    the event itself (``check_run`` / ``check_suite``).

    Used to *drop*, so it must never return True for a payload no consumer would
    act on: it is fine to be conservative here, never optimistic.
    """
    repo_id = get_path(event, "repository", "id")
    if repo_id is None:
        return False

    refs = get_path(event, container_key, "pull_requests")
    if not isinstance(refs, list):
        return False

    return any(is_own_repo_pull_request(pull_request_base_repo_id(ref), repo_id) for ref in refs)
