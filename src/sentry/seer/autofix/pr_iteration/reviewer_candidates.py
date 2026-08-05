"""Ranked reviewer candidates for a Seer-authored PR.

Requesting the whole owning team rebuilds the bystander effect, so the
review-request flow asks one specific person. This module computes who that
person should be. A resolvable triggering user is the sole candidate: they
asked for the fix and are the person most invested in it landing, so Seer
never needs to pull anyone else in. Only when no triggering user can be
asked (e.g. Night Shift, or an identity we can't map to a GitHub login)
does selection fan out to people who didn't opt in, in rank order:

1. ``suspect_commit_author`` — the author of the issue's suspect commit; they
   wrote the code being fixed.
2. ``code_owner`` — individual owners of the changed files per the repo's
   synced CODEOWNERS (``ProjectCodeOwners``); teams are skipped on purpose.
3. ``recent_committer`` — the most frequent recent committers of the changed
   files, via the provider's per-path commit listing (Seer checkouts are
   tarball extracts with no git history, so the provider API is the only
   source for this).

Each candidate carries its source as provenance so we can measure which
source's reviewers actually respond. The list is computed lazily at decision
time (the sources go stale, and most green events never reach a request) and
persisted on ``SeerRun`` so a later re-request can fall back to the next
candidate without recomputing.
"""

from __future__ import annotations

import logging
import re
from collections import Counter
from collections.abc import Callable, Collection, Mapping
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from django.db.models import F
from django.db.models.functions import Lower
from django.utils import timezone
from scm import actions as scm_actions
from scm.helpers import iter_all_pages
from scm.manager import SourceCodeManager
from scm.types import GetCommitsByPathProtocol, GetPullRequestFilesProtocol, PullRequestFile

from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.types import ExternalProviders
from sentry.issues.ownership.grammar import get_codeowners_path_and_owners
from sentry.models.commit import Commit
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.models.organization import Organization
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.models.repository import Repository
from sentry.seer.autofix.pr_iteration.run_markers import get_run_marker, record_run_marker
from sentry.seer.models.run import SeerRun
from sentry.seer.utils import get_github_username_for_user
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.utils.codeowners import codeowners_match

logger = logging.getLogger(__name__)

# Provenance labels stored per candidate and used as metric tag values.
SOURCE_TRIGGERING_USER = "triggering_user"
SOURCE_SUSPECT_COMMIT_AUTHOR = "suspect_commit_author"
SOURCE_CODE_OWNER = "code_owner"
SOURCE_RECENT_COMMITTER = "recent_committer"

# Bounds on provider work per computation: how many of the PR's changed files
# we fetch and match against CODEOWNERS, and for how many of those (the most
# heavily changed) we list per-path commit history.
MAX_CHANGED_FILES = 20
MAX_COMMIT_HISTORY_FILES = 5
# Committers older than this have likely lost context on the file.
RECENT_COMMITS_MAX_AGE = timedelta(days=90)

# Extras stay small: past this point candidates are noise, not fallbacks.
MAX_CANDIDATES = 8

# SeerRun.extras key holding the computed candidates, keyed by repo full name
# (a run can open PRs in several repos). Each marker records the ranked list
# with provenance so re-request logic can fall back without recomputing.
REVIEWER_CANDIDATES_EXTRA = "reviewer_candidates"


@dataclass(frozen=True)
class ReviewerCandidate:
    """A GitHub login we could ask for review, and which source proposed it."""

    login: str
    source: str


def get_reviewer_candidates_marker(seer_run: SeerRun, repo_name: str) -> dict[str, Any] | None:
    return get_run_marker(seer_run, REVIEWER_CANDIDATES_EXTRA, repo_name)


def record_reviewer_candidates_marker(
    seer_run: SeerRun,
    repo_name: str,
    *,
    head_sha: str,
    candidates: list[ReviewerCandidate],
) -> None:
    record_run_marker(
        seer_run,
        REVIEWER_CANDIDATES_EXTRA,
        repo_name,
        {
            "computed_at": timezone.now().isoformat(),
            "head_sha": head_sha,
            "candidates": [{"login": c.login, "source": c.source} for c in candidates],
        },
    )


def collect_reviewer_candidates(
    *,
    organization: Organization,
    repository: Repository,
    seer_run: SeerRun,
    group_id: int,
    scm: SourceCodeManager,
    pr_number: int,
    exclude_logins: Collection[str] = (),
    log_extra: Mapping[str, Any],
) -> list[ReviewerCandidate]:
    """The ranked reviewer candidates for a Seer PR, best first.

    A resolvable triggering user short-circuits as the sole candidate, with
    no provider calls; the other sources are only consulted as the fallback
    that makes runs without one routable at all.

    Bots, ``exclude_logins`` (e.g. the PR author), and duplicates are dropped;
    a login proposed by several sources keeps its highest-ranked provenance.
    A source that errors is skipped so one flaky lookup can't empty the list.
    """
    excluded = {login.lower() for login in exclude_logins}
    candidates: list[ReviewerCandidate] = []
    seen: set[str] = set()

    def resolve_source(source: str, resolve: Callable[[], list[str]]) -> None:
        try:
            logins = resolve()
        except Exception:
            metrics.incr(
                "autofix.pr_iteration.reviewer_candidates.source_failed", tags={"source": source}
            )
            logger.warning(
                "autofix.pr_iteration.reviewer_candidates.source_failed",
                extra={**log_extra, "source": source},
                exc_info=True,
            )
            return
        # Sizes each source's resolution rate — e.g. how often a triggering
        # user exists but has no mappable GitHub identity.
        metrics.incr(
            "autofix.pr_iteration.reviewer_candidates.source_resolved",
            tags={"source": source, "found": str(bool(logins)).lower()},
        )
        for login in logins:
            key = login.lower()
            if key in seen or key in excluded or _is_bot_login(login):
                continue
            seen.add(key)
            candidates.append(ReviewerCandidate(login=login, source=source))

    resolve_source(SOURCE_TRIGGERING_USER, lambda: _triggering_user_logins(seer_run, organization))
    if candidates:
        return candidates

    changed_files = _changed_files(scm, pr_number, log_extra)
    fallback_sources: list[tuple[str, Callable[[], list[str]]]] = [
        (
            SOURCE_SUSPECT_COMMIT_AUTHOR,
            lambda: _suspect_commit_author_logins(organization, group_id),
        ),
        (SOURCE_CODE_OWNER, lambda: _code_owner_logins(repository, changed_files)),
        (SOURCE_RECENT_COMMITTER, lambda: _recent_committer_logins(scm, changed_files, log_extra)),
    ]
    for source, resolve in fallback_sources:
        resolve_source(source, resolve)

    return candidates[:MAX_CANDIDATES]


def _is_bot_login(login: str) -> bool:
    # GitHub app identities ("dependabot[bot]"). Human-named bot accounts are
    # caught per source where richer data exists (e.g. the commit author type).
    return login.lower().endswith("[bot]")


def _triggering_user_logins(seer_run: SeerRun, organization: Organization) -> list[str]:
    if seer_run.user_id is None:
        # System runs (e.g. Night Shift) have no triggering user; the other
        # sources are what makes their PRs routable at all.
        return []
    user = user_service.get_user(user_id=seer_run.user_id)
    if user is None:
        return []
    login = get_github_username_for_user(user, organization.id, referrer="pr_reviewer_candidates")
    return [login] if login else []


def _suspect_commit_author_logins(organization: Organization, group_id: int) -> list[str]:
    """The GitHub login of the issue's suspect-commit author, if resolvable."""
    group_owner = next(
        (
            owner
            for owner in GroupOwner.objects.filter(
                group_id=group_id,
                organization_id=organization.id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
                context__isnull=False,
            ).order_by("-date_added")
            if (owner.context or {}).get("commitId")
        ),
        None,
    )
    if group_owner is None:
        return []

    commit = (
        Commit.objects.filter(id=group_owner.context["commitId"], organization_id=organization.id)
        .select_related("author")
        .first()
    )
    if commit is not None and commit.author is not None:
        login = commit.author.get_username_from_external_id()
        if login:
            return [login]

    # The commit author has no GitHub identity on record, but suspect-commit
    # detection may still have matched them to a Sentry user by email.
    if group_owner.user_id is not None:
        user = user_service.get_user(user_id=group_owner.user_id)
        if user is not None:
            login = get_github_username_for_user(
                user, organization.id, referrer="pr_reviewer_candidates"
            )
            if login:
                return [login]
    return []


def _changed_files(
    scm: SourceCodeManager, pr_number: int, log_extra: Mapping[str, Any]
) -> list[PullRequestFile]:
    if not isinstance(scm, GetPullRequestFilesProtocol):
        return []
    files: list[PullRequestFile] = []
    try:
        for page in iter_all_pages(
            lambda pagination: scm_actions.get_pull_request_files(
                scm, str(pr_number), pagination=pagination
            )
        ):
            files.extend(page["data"])
            if len(files) >= MAX_CHANGED_FILES:
                break
    except Exception:
        # Partial data still feeds the file-based sources; the file-free
        # sources are unaffected either way.
        logger.warning(
            "autofix.pr_iteration.reviewer_candidates.changed_files_failed",
            extra=dict(log_extra),
            exc_info=True,
        )
    return files[:MAX_CHANGED_FILES]


def _code_owner_logins(repository: Repository, changed_files: list[PullRequestFile]) -> list[str]:
    """Individual code owners of the changed files, most files owned first.

    Only ``@login`` entries with a linked Sentry identity (``ExternalActor``)
    are kept: team owners recreate the diffuse team-level request this feature
    exists to avoid, and unlinked names can't be trusted to still be valid.
    """
    if not changed_files:
        return []
    # Several projects can sync the same repo's CODEOWNERS file; prefer the
    # copy whose raw content was fetched most recently. ``date_updated`` alone
    # can't tell that apart: schema-only rebuilds (e.g. on team changes) bump
    # it without refreshing ``raw``. ``date_synced`` is the fetch timestamp,
    # but is NULL for manually uploaded copies, where ``date_updated`` is the
    # only freshness signal left.
    codeowners = (
        ProjectCodeOwners.objects.filter(
            repository_project_path_config__project_repository__repository=repository
        )
        .order_by(F("date_synced").desc(nulls_last=True), "-date_updated")
        .first()
    )
    if codeowners is None or not codeowners.raw:
        return []

    rules = _parse_codeowners_rules(codeowners.raw)
    if not rules:
        return []

    owner_file_counts: Counter[str] = Counter()
    for changed_file in changed_files:
        for owner in _owners_for_path(rules, changed_file["filename"]):
            owner_file_counts[owner] += 1

    handles = [
        owner
        for owner in owner_file_counts
        if owner.startswith("@") and "/" not in owner  # individuals, not teams
    ]
    if not handles:
        return []

    # Org-scoped on purpose, matching how the triggering-user source resolves
    # identities: reviewing happens on GitHub, where repo access is what
    # matters, so requiring Sentry team access on whichever single project the
    # CODEOWNERS row belongs to would wrongly drop owners in multi-project
    # repos.
    linked_handles = set(
        ExternalActor.objects.annotate(external_name_lower=Lower("external_name"))
        .filter(
            external_name_lower__in={handle.lower() for handle in handles},
            organization_id=repository.organization_id,
            provider__in=[
                ExternalProviders.GITHUB.value,
                ExternalProviders.GITHUB_ENTERPRISE.value,
            ],
            user_id__isnull=False,
        )
        .values_list("external_name_lower", flat=True)
    )
    return [
        handle.removeprefix("@")
        for handle, _count in owner_file_counts.most_common()
        if handle in handles and handle.lower() in linked_handles
    ]


# Path patterns GitHub documents as unsupported syntax exceptions and ignores:
# `[]` character ranges (which is also what a stray GitLab-style "[Section]"
# header parses to), `!` negation, and unescaped whitespace. Skipped the same
# way ``convert_codeowners_syntax`` skips them.
_CODEOWNERS_SYNTAX_EXCEPTIONS = re.compile(r"(\[([^]^\s]*)\])|[\s!#]")


def _parse_codeowners_rules(raw: str) -> list[tuple[str, list[str]]]:
    rules = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            path, owners = get_codeowners_path_and_owners(line)
        except ValueError:
            # CODEOWNERS files in the wild contain malformed lines; GitHub
            # ignores them, so we do too.
            continue
        if _CODEOWNERS_SYNTAX_EXCEPTIONS.search(path):
            continue
        rules.append((path, list(owners)))
    return rules


def _owners_for_path(rules: list[tuple[str, list[str]]], path: str) -> list[str]:
    # CODEOWNERS semantics: the last matching rule wins, even when it lists no
    # owners (which un-owns the path).
    owners: list[str] = []
    for pattern, rule_owners in rules:
        if codeowners_match(path, pattern):
            owners = rule_owners
    return owners


def _recent_committer_logins(
    scm: SourceCodeManager, changed_files: list[PullRequestFile], log_extra: Mapping[str, Any]
) -> list[str]:
    """Most frequent recent committers of the changed files, via the provider.

    Only the most heavily changed files are consulted, one page of history
    each; that is plenty of signal for a ranking. Listing against the default
    branch (ref ``None``) keeps the Seer PR's own commits out of the counts.
    """
    if not changed_files or not isinstance(scm, GetCommitsByPathProtocol):
        return []

    by_change_size = sorted(changed_files, key=lambda f: f.get("changes") or 0, reverse=True)
    paths = [f["filename"] for f in by_change_size[:MAX_COMMIT_HISTORY_FILES]]
    since = timezone.now() - RECENT_COMMITS_MAX_AGE

    counts: Counter[str] = Counter()
    display_logins: dict[str, str] = {}
    for path in paths:
        try:
            result = scm_actions.get_commits_by_path(scm, path, since=since)
            # The normalized Commit only carries the git name/email; the
            # provider login and account type are only in the raw payload.
            raw_commits = result["raw"]["data"] or []
        except Exception:
            # One failing path shouldn't cost the ranking its other paths.
            logger.warning(
                "autofix.pr_iteration.reviewer_candidates.commits_by_path_failed",
                extra={**log_extra, "path": path},
                exc_info=True,
            )
            continue
        for raw_commit in raw_commits:
            author = raw_commit.get("author") or {}
            login = author.get("login")
            if not login or author.get("type") != "User":
                continue
            key = login.lower()
            counts[key] += 1
            display_logins.setdefault(key, login)

    return [display_logins[key] for key, _count in counts.most_common()]
