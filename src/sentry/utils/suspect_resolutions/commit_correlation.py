from __future__ import annotations

from typing import Set

from sentry.models import CommitFileChange, Group, GroupRelease, Project, ReleaseCommit


def is_issue_commit_correlated(resolved_issue: int, candidate_issue: int, project: int) -> bool:
    resolved_issue_release_ids, resolved_issue_files = get_files_changed(resolved_issue, project)
    candidate_issue_release_ids, candidate_issue_files = get_files_changed(candidate_issue, project)

    if len(resolved_issue_files) == 0 or len(candidate_issue_files) == 0:
        return False

    return (
        not resolved_issue_files.isdisjoint(candidate_issue_files),
        resolved_issue_release_ids,
        candidate_issue_release_ids,
    )


def get_files_changed(issue: Group, project: Project) -> Set:
    releases = GroupRelease.objects.filter(group_id=issue.id, project_id=project.id).values_list(
        "release_id", flat=True
    )

    if releases:
        files_changed_in_releases = set(
            CommitFileChange.objects.filter(
                commit_id__in=ReleaseCommit.objects.filter(release__in=releases).values_list(
                    "commit_id", flat=True
                )
            )
            .values_list("filename", flat=True)
            .distinct()
        )
    else:
        return set()
    return (list(releases), files_changed_in_releases)
