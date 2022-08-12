from __future__ import annotations

from django.utils import timezone
from dataclasses import dataclass
from typing import Sequence, Set

from sentry.models import CommitFileChange, GroupRelease, ReleaseCommit


@dataclass
class CommitCorrelatedResult:
    is_correlated: bool
    resolved_issue_release_ids: Sequence[int]
    candidate_issue_release_ids: Sequence[int]


@dataclass
class ReleaseCommitFileChanges:
    release_ids: Sequence[int]
    files_changed: Set[str]


def is_issue_commit_correlated(
    resolved_issue: int, candidate_issue: int, project: int
) -> CommitCorrelatedResult:
    resolved_filechanges = get_files_changed_in_releases(resolved_issue, project)
    candidate_filechanges = get_files_changed_in_releases(candidate_issue, project)

    if (
        len(resolved_filechanges.files_changed) == 0
        or len(candidate_filechanges.files_changed) == 0
    ):
        return CommitCorrelatedResult(False, [], [])

    return CommitCorrelatedResult(
        not resolved_filechanges.files_changed.isdisjoint(candidate_filechanges.files_changed),
        resolved_filechanges.release_ids,
        resolved_filechanges.release_ids,
    )


def get_files_changed(issue_id: int, project_id: int) -> Tuple[List[int], Set[str]]:
    releases = GroupRelease.objects.filter(
        group_id=issue_id,
        project_id=project_id,
        last_seen__gte=(timezone.now() - timedelta(hours=5)),
    ).values_list("release_id", flat=True)

    if not releases:
        return ReleaseCommitFileChanges([], set())

    files_changed_in_releases = set(
        CommitFileChange.objects.filter(
            commit_id__in=ReleaseCommit.objects.filter(release__in=releases).values_list(
                "commit_id", flat=True
            )
        )
        .values_list("filename", flat=True)
        .distinct()
    )

    return ReleaseCommitFileChanges(releases, files_changed_in_releases)
