from collections import defaultdict

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers.models.release import expose_version_info
from sentry.models import CommitFileChange, ProjectPlatform, Release, ReleaseCommit, ReleaseProject


class OrganizationReleaseMetaEndpoint(OrganizationReleasesBaseEndpoint):
    def get(self, request, organization, version):
        """
        Retrieve an Organization's Release's Associated Meta Data
        `````````````````````````````````````````````````````````

        The data returned from here is auxiliary meta data that the UI uses.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.get(organization_id=organization.id, version=version)
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        if not self.has_release_permission(request, organization, release):
            raise ResourceDoesNotExist

        commit_files_changed = (
            CommitFileChange.objects.filter(
                commit_id__in=ReleaseCommit.objects.filter(release=release).values_list(
                    "commit_id", flat=True
                )
            )
            .values("filename")
            .distinct()
            .count()
        )

        project_releases = ReleaseProject.objects.filter(release=release).values(
            "new_groups",
            "release_id",
            "release__version",
            "project__slug",
            "project__name",
            "project__id",
            "project__platform",
        )

        platforms = ProjectPlatform.objects.filter(
            project_id__in={x["project__id"] for x in project_releases}
        ).values_list("project_id", "platform")
        platforms_by_project = defaultdict(list)
        for project_id, platform in platforms:
            platforms_by_project[project_id].append(platform)

        # This must match what is returned from the `Release` serializer
        projects = [
            {
                "id": pr["project__id"],
                "slug": pr["project__slug"],
                "name": pr["project__name"],
                "newGroups": pr["new_groups"],
                "platform": pr["project__platform"],
                "platforms": platforms_by_project.get(pr["project__id"]) or [],
            }
            for pr in project_releases
        ]

        return Response(
            {
                "version": release.version,
                "versionInfo": expose_version_info(release.version_info),
                "projects": projects,
                "newGroups": release.new_groups,
                "deployCount": release.total_deploys,
                "commitCount": release.commit_count,
                "released": release.date_released or release.date_added,
                "commitFilesChanged": commit_files_changed,
                "releaseFileCount": release.count_artifacts(),
            }
        )
