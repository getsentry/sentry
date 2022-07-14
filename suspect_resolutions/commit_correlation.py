from __future__ import annotations

from typing import Set

from django.db.models import DateTimeField

from sentry.models import CommitFileChange, GroupRelease, ReleaseCommit


def is_issue_commit_correlated(
    resolved_issue_id: int, candidate_issue_id: int, start: DateTimeField, end: DateTimeField
) -> bool:

    resolved_issue_files = get_files_changed(resolved_issue_id, start, end)
    candidate_suspect_resolution_files = get_files_changed(candidate_issue_id, start, end)

    if len(resolved_issue_files) == 0 or len(candidate_suspect_resolution_files) == 0:
        return False

    return not resolved_issue_files.isdisjoint(candidate_suspect_resolution_files)


def get_files_changed(issue_id: int, start: DateTimeField, end: DateTimeField) -> Set:
    releases = GroupRelease.objects.filter(
        group_id=issue_id, first_seen__gte=start, first_seen__lte=end
    ).values_list("release_id")

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
