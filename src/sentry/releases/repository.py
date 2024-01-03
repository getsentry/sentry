from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from logging import Logger, getLogger
from typing import TYPE_CHECKING, Generator, List, Optional

from django.db.models import F, Q, QuerySet

from sentry.models.deploy import Deploy
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.services.hybrid_cloud.organization import RpcOrganization

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.models.release_threshold.release_threshold import ReleaseThreshold

default_logger = getLogger("sentry.releases.repository")


@dataclass
class TimeRange:
    start: datetime
    end: datetime


@dataclass
class ReleaseThresholds:
    release: Release
    project: Project
    thresholds: List[ReleaseThreshold]

    def get_latest_deploy_id_by_threshold(self, index: int) -> Optional[Deploy]:
        if index >= len(self.thresholds):
            return None

        threshold = self.thresholds[index]
        if not threshold.environment:
            return None

        # NOTE: if a threshold has no environment set, we monitor from start of the release creation
        # If a deploy does not exist for the thresholds environment, we monitor from start of release creation
        # ReleaseProjectEnvironment model
        rpe_entry: ReleaseProjectEnvironment | None = next(
            (
                rpe
                for rpe in self.release.releaseprojectenvironment_set.all()
                if rpe.environment == threshold.environment and rpe.project == self.project
            ),
            None,
        )
        if not rpe_entry:
            return None

        last_deploy_id = rpe_entry.last_deploy_id
        latest_deploy = next(
            (deploy for deploy in self.release.deploy_set.all() if deploy.id == last_deploy_id),
            None,
        )

        return latest_deploy

    def get_threshold_key(self) -> str:
        """
        Consistent key helps to determine which thresholds can be grouped together.
        project_slug - release_version

        NOTE: release versions can contain special characters... `-` delimiter may not be appropriate
        """
        return f"{self.project.slug}-{self.release.version}"


class ReleaseThresholdsRepository:
    def __init__(self, logger: Logger = default_logger) -> None:
        self.logger = logger

    def _get_releases(
        self,
        organization: Organization | RpcOrganization,
        time_range: TimeRange,
        environments: Optional[List[str]] = None,
        project_slugs: Optional[List[str]] = None,
        versions: Optional[List[str]] = None,
    ) -> QuerySet:
        query = Q(
            organization=organization,
            date_added__gte=time_range.start,
            date_added__lte=time_range.end,
        )
        if environments:
            query &= Q(
                releaseprojectenvironment__environment__name__in=environments,
            )
        if project_slugs:
            query &= Q(
                projects__slug__in=project_slugs,
            )
        if versions:
            query &= Q(
                version__in=versions,
            )

        queryset = (
            Release.objects.filter(query)
            .annotate(
                date=F("date_added"),  # transforms date_added into 'date'
            )
            .order_by("-date")
            .distinct()
        )

        # prefetching the release_thresholds via the projects model
        queryset.prefetch_related("projects__release_thresholds__environment")
        queryset.prefetch_related("releaseprojectenvironment_set")
        queryset.prefetch_related("deploy_set")

        self.logger.info(
            "Fetched releases",
            extra={
                "results": len(queryset),
                "project_slugs": project_slugs,
                "releases": versions,
                "environments": environments,
            },
        )

        return queryset

    def get_release_thresholds(
        self,
        organization: Organization | RpcOrganization,
        time_range: TimeRange,
        environments: Optional[List[str]] = None,
        project_slugs: Optional[List[str]] = None,
        versions: Optional[List[str]] = None,
    ) -> Generator[ReleaseThresholds, None, None]:
        """
        Iterate over, and get the data grouped together by what is needed
        """
        releases = self._get_releases(
            organization=organization,
            time_range=time_range,
            environments=environments,
            project_slugs=project_slugs,
            versions=versions,
        )
        for release in releases:
            # TODO:
            # We should update release model to preserve threshold states.
            # if release.failed_thresholds/passed_thresholds exists - then skip calculating and just return thresholds
            release_projects = [
                p
                for p in release.projects.all()
                if (project_slugs and p.slug in project_slugs) or (not project_slugs)
            ]

            for project in release_projects:
                project_thresholds: List[ReleaseThreshold] = [
                    t
                    for t in project.release_thresholds.all()
                    if (environments and t.environment and t.environment.name in environments)
                    or (not environments)
                ]

                yield ReleaseThresholds(
                    release=release, project=project, thresholds=project_thresholds
                )
