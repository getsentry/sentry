from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Sequence, Set

from sentry.models.commitfilechange import CommitFileChange
from sentry.models.group import Group
from sentry.models.grouprelease import GroupRelease
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit


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
    resolved_issue_time = Group.objects.filter(id=resolved_issue).first().resolved_at
    resolved_filechanges = get_files_changed_in_releases(
        resolved_issue_time, resolved_issue, project
    )
    candidate_filechanges = get_files_changed_in_releases(
        resolved_issue_time, candidate_issue, project
    )

    if (
        len(resolved_filechanges.files_changed) == 0
        or len(candidate_filechanges.files_changed) == 0
    ):
        return CommitCorrelatedResult(False, [], [])

    return CommitCorrelatedResult(
        not resolved_filechanges.files_changed.isdisjoint(candidate_filechanges.files_changed),
        resolved_filechanges.release_ids,
        candidate_filechanges.release_ids,
    )


def get_files_changed_in_releases(
    resolved_issue_time: datetime, issue_id: int, project_id: int
) -> ReleaseCommitFileChanges:
    releases = list(
        Release.objects.filter(
            id__in=GroupRelease.objects.filter(
                group_id=issue_id,
                project_id=project_id,
            ).values_list("release_id", flat=True),
            date_added__gte=(resolved_issue_time - timedelta(hours=5)),
        )
    )
    if len(releases) == 0:
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

    return ReleaseCommitFileChanges([release.id for release in releases], files_changed_in_releases)
