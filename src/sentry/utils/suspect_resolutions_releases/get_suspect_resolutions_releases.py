from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from typing import Mapping, Sequence

from django.utils import timezone

from sentry import features
from sentry.models.group import Group, GroupStatus
from sentry.models.grouprelease import GroupRelease
from sentry.models.release import Release, ReleaseProject
from sentry.signals import release_created
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils.suspect_resolutions_releases import ALGO_VERSION, analytics


@release_created.connect(weak=False)
def record_suspect_resolutions_releases(release, **kwargs) -> None:
    release_projects = list(release.projects.all())
    if len(release_projects) > 0 and features.has(
        "projects:suspect-resolutions", release_projects[0]
    ):
        get_suspect_resolutions_releases.delay(
            release,
            eta=timezone.now() + timedelta(hours=1),
            expires=timezone.now() + timedelta(hours=1, minutes=30),
        )


@instrumented_task(
    name="sentry.tasks.get_suspect_resolutions_releases",
    queue="get_suspect_resolutions_releases",
    silo_mode=SiloMode.REGION,
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
        releases_by_project: Mapping[int, list[Release]] = defaultdict(list)
        for rp in prev_release_projects:
            releases_by_project[rp.project.id].append(rp.release)

        latest_release_per_project = {
            project_id: max(r_list, key=lambda r: r.date_added)
            for project_id, r_list in releases_by_project.items()
        }

        active_issue_per_project = {
            project_id: Group.objects.filter(
                id__in=list(
                    GroupRelease.objects.filter(release_id=release.id).values_list(
                        "group_id", flat=True
                    )
                ),
                status=GroupStatus.UNRESOLVED,
            )
            for project_id, release in latest_release_per_project.items()
        }

        suspect_issue_candidates = {
            group_ids_by_project[0]
            for project_id, group_ids_by_project in active_issue_per_project.items()
            if len(group_ids_by_project) > 0
        }

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
                latest_release_id=latest_release_per_project[issue.project.id].id,
            )

        return suspect_resolution_issue_ids
    else:
        return []
