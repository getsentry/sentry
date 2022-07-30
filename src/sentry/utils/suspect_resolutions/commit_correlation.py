from __future__ import annotations

from typing import List, Set

from sentry.models import (
    Activity,
    CommitFileChange,
    Group,
    GroupRelease,
    GroupStatus,
    Project,
    Release,
    ReleaseCommit,
)
from sentry.types.activity import ActivityType


def is_issue_commit_correlated(resolved_issue: int, candidate_issue: int, project: int) -> bool:
    resolved_issue_files = get_files_changed(resolved_issue, project)
    candidate_suspect_resolution_files = get_files_changed(candidate_issue, project)

    if len(resolved_issue_files) == 0 or len(candidate_suspect_resolution_files) == 0:
        return False

    return not resolved_issue_files.isdisjoint(candidate_suspect_resolution_files)


def get_files_changed(issue: Group, project: Project) -> Set:

    activity = Activity.objects.filter(project=project, group=issue).first()

    if activity is None:
        return set()

    # print(issue.status)

    if (
        activity.type == ActivityType.SET_RESOLVED_IN_RELEASE.value
        or ActivityType.SET_RESOLVED_IN_COMMIT.value
        or ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value
        or issue.status == GroupStatus.UNRESOLVED
    ):

        releases = GroupRelease.objects.filter(
            group_id=issue.id, project_id=project.id
        ).values_list("release_id", flat=True)

        if releases:
            return get_files_changed_in_releases(releases)

    elif activity.type == ActivityType.SET_RESOLVED.value:

        issue_creation = Group.objects.filter(id=issue.id).values_list("first_seen")
        issue_resolution = Group.objects.filter(id=issue.id).values_list("resolved_at")

        releases = Release.objects.filter(
            date_released__gte=issue_creation, date_released__lte=issue_resolution
        ).values_list("id")

        if releases:
            return get_files_changed_in_releases(releases)

    else:
        return set()


def get_files_changed_in_releases(releases: List[int]):
    files_changed_in_release = set(
        CommitFileChange.objects.filter(
            commit_id__in=ReleaseCommit.objects.filter(release__in=releases).values_list(
                "commit_id", flat=True
            )
        ).values_list("filename", flat=True)
    )
    return files_changed_in_release
