from typing import Sequence

from sentry import features
from sentry.models import Group, GroupRelease, GroupStatus, Project, Release, ReleaseProject
from sentry.signals import release_created
from sentry.tasks.base import instrumented_task
from sentry.utils.suspect_resolutions_releases import ALGO_VERSION, analytics


@release_created.connect(weak=False)
def record_suspect_resolutions_releases(release, project, **kwargs) -> None:
    if features.has("projects:suspect-resolutions-releases", project):
        get_suspect_resolutions_releases.delay(release, project)


@instrumented_task(
    name="sentry.tasks.get_suspect_resolutions_releases", queue="get_suspect_resolutions_releases"
)
def get_suspect_resolutions_releases(release: Release, project: Project) -> Sequence[int]:
    suspect_resolution_issue_ids = []
    is_suspect_resolution = False

    releases_in_project = ReleaseProject.objects.filter(project=project).values_list("release_id")
    latest_release = Release.objects.filter(id__in=releases_in_project).order_by("-date_added")[1]
    latest_release_active_issue_ids = GroupRelease.objects.filter(
        release_id=latest_release.id
    ).values_list("group_id", flat=True)
    latest_release_active_issues = list(
        Group.objects.filter(id__in=latest_release_active_issue_ids)
    )

    suspect_issue_candidates = [
        issue for issue in latest_release_active_issues if issue.status == GroupStatus.UNRESOLVED
    ]

    for issue in suspect_issue_candidates:
        if issue.last_seen < release.date_added:
            suspect_resolution_issue_ids.append(issue.id)
            is_suspect_resolution = True

        analytics.record(
            "suspect_resolution_releases.evaluation",
            algo_version=ALGO_VERSION,
            latest_release_id=latest_release.id,
            current_release_id=release.id,
            issue_id=issue.id,
            project_id=project.id,
            is_suspect_resolution=is_suspect_resolution,
        )

    return suspect_resolution_issue_ids
