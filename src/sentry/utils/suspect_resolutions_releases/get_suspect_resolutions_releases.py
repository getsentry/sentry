from collections import defaultdict
from datetime import timedelta, timezone
from typing import Mapping, Sequence

from sentry import features
from sentry.models import Group, GroupRelease, GroupStatus, Release, ReleaseProject
from sentry.signals import release_created
from sentry.tasks.base import instrumented_task
from sentry.utils.suspect_resolutions_releases import ALGO_VERSION, analytics


@release_created.connect(weak=False)
def record_suspect_resolutions_releases(release, **kwargs) -> None:
    if features.has("projects:suspect-resolutions"):
        get_suspect_resolutions_releases.delay(
            release,
            eta=timezone.now() + timedelta(hours=1),
            expires=timezone.now() + timedelta(hours=1, minutes=30),
        )


@instrumented_task(
    name="sentry.tasks.get_suspect_resolutions_releases", queue="get_suspect_resolutions_releases"
)
def get_suspect_resolutions_releases(release: Release) -> Sequence[int]:
    suspect_resolution_issue_ids = []
    is_suspect_resolution = False

    if release.projects:
        prev_release_projects = (
            ReleaseProject.objects.filter(
                project__in=release.projects.all(), release__date_added__lt=release.date_added
            )
            .exclude(release=release)
            .order_by("-release__date_added")
        )
        releases_by_project: Mapping[int, Sequence[Release]] = defaultdict(list)
        for rp in prev_release_projects:
            releases_by_project[rp.project.id].append(rp.release)

        latest_release_per_project = {
            project_id: max(r_list, key=lambda r: r.date_added)
            for project_id, r_list in releases_by_project.items()
        }

        active_issue_ids_per_project = {
            project_id: GroupRelease.objects.filter(release_id=release.id).values_list(
                "group_id", flat=True
            )
            for project_id, release in latest_release_per_project.items()
        }

        suspect_issue_candidate_ids = [
            group_id.first()
            for project_id, group_id in active_issue_ids_per_project.items()
            if Group.objects.filter(id=group_id.first(), status=GroupStatus.UNRESOLVED)
        ]
        suspect_issue_candidates = list(Group.objects.filter(id__in=suspect_issue_candidate_ids))

        for issue in suspect_issue_candidates:
            if issue.last_seen < release.date_added:
                suspect_resolution_issue_ids.append(issue.id)
                is_suspect_resolution = True

            analytics.record(
                "suspect_resolution_releases.evaluation",
                algo_version=ALGO_VERSION,
                current_release_id=release.id,
                issue_id=issue.id,
                is_suspect_resolution=is_suspect_resolution,
            )

        return suspect_resolution_issue_ids
