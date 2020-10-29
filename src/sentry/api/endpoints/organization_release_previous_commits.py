from __future__ import absolute_import

from rest_framework.response import Response

from sentry import analytics

from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Release


class OrganizationReleasePreviousCommitsEndpoint(OrganizationReleasesBaseEndpoint):
    def get(self, request, organization, version):
        """
        Retrieve an Organization's Most Recent Release with Commits
        ````````````````````````````````````````````````````````````

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

        start_date = release.date_released or release.date_added

        prev_release_with_commits = (
            Release.objects.filter(
                organization_id=organization.id,
                projects__in=release.projects.all(),
                last_commit_id__isnull=False,
            )
            .extra(
                select={"date": "COALESCE(date_released, date_added)"},
                where=["COALESCE(date_released, date_added) <= %s"],
                params=[start_date],
            )
            .extra(order_by=["-date"])[:1]
        )

        analytics.record(
            "release.get_previous_commits",
            user_id=request.user.id if request.user and request.user.id else None,
            organization_id=organization.id,
            project_ids=[project.id for project in release.projects.all()],
            user_agent=request.META.get("HTTP_USER_AGENT", ""),
        )

        if not prev_release_with_commits:
            return Response({})

        return Response(serialize(prev_release_with_commits[0], request.user,))
