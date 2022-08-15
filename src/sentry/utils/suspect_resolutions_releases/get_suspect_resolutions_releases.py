from typing import Sequence

from sentry import features
from sentry.models import Group, GroupStatus, Project, Release
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

    suspect_issue_candidates = list(
        Group.objects.filter(
            status=GroupStatus.UNRESOLVED,
            project=project,
        )
    )

    for issue in suspect_issue_candidates:
        if issue.last_seen < release.date_released:
            suspect_resolution_issue_ids.append(issue.id)

        analytics.record(
            "suspect_resolution_releases.evaluation",
            algo_version=ALGO_VERSION,
            release_id=release.id,
            issue_id=issue.id,
            project_id=project.id,
        )

    return suspect_resolution_issue_ids
