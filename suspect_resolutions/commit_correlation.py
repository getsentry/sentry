from __future__ import annotations

from sentry.models import CommitFileChange, GroupRelease, ReleaseCommit


def is_issue_commit_correlated(resolved_issue_id: int, candidate_issue_id: int) -> bool:
    # test whether the resolved_issue commit data is related to the suspect issue commit data
    # check set intersection between set of files touched by one issue with set of files touched by another issue
    # check line changes to make it more accurate

    resolved_issue_files = {filename for filename in (get_files_changed(resolved_issue_id))}
    candidate_suspect_resolution_files = {
        filename for filename in (get_files_changed(candidate_issue_id))
    }

    return not resolved_issue_files.isdisjoint(candidate_suspect_resolution_files)


def get_files_changed(issue_id: int):
    # get release associated with the issue
    release = (
        GroupRelease.objects.filter(group_id=issue_id)
        .values_list("release_id")
        .order_by("-last_seen")[0]
    )

    # get all files changed in the latest release
    files_changed_in_release = CommitFileChange.objects.filter(
        commit_id__in=ReleaseCommit.objects.filter(release=release).values_list(
            "commit_id", flat=True
        )
    ).values_list("filename", flat=True)

    return files_changed_in_release
