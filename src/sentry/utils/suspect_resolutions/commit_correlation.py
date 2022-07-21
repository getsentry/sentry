from __future__ import annotations

from typing import Set

from sentry.models import CommitFileChange, GroupRelease, ReleaseCommit


def is_issue_commit_correlated(
    resolved_issue_id: int, candidate_issue_id: int, project_id: int
) -> bool:

    resolved_issue_files = get_files_changed(resolved_issue_id, project_id)
    candidate_suspect_resolution_files = get_files_changed(candidate_issue_id, project_id)

    if len(resolved_issue_files) == 0 or len(candidate_suspect_resolution_files) == 0:
        return False

    return not resolved_issue_files.isdisjoint(candidate_suspect_resolution_files)


def get_files_changed(issue_id: int, project_id: int) -> Set:

    releases = GroupRelease.objects.filter(group_id=issue_id, project_id=project_id).values_list(
        "release_id", flat=True
    )

    if releases:
        files_changed_in_release = set(
            CommitFileChange.objects.filter(
                commit_id__in=ReleaseCommit.objects.filter(release__in=releases).values_list(
                    "commit_id", flat=True
                )
            ).values_list("filename", flat=True)
        )
    else:
        return set()

    return files_changed_in_release
