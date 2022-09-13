from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseCommit


@region_silo_endpoint
class OrganizationReleaseCommitsEndpoint(OrganizationReleasesBaseEndpoint):
    def get(self, request: Request, organization, version) -> Response:
        """
        List an Organization Release's Commits
        ``````````````````````````````````````

        Retrieve a list of commits for a given release.

        :pparam string organization_slug: the slug of the organization the
                                          release belongs to.
        :pparam string version: the version identifier of the release.
        :auth: required
        """
        try:
            release = Release.objects.distinct().get(
                organization_id=organization.id,
                projects__in=self.get_projects(request, organization),
                version=version,
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        queryset = ReleaseCommit.objects.filter(release=release).select_related(
            "commit", "commit__author"
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="order",
            on_results=lambda x: serialize([rc.commit for rc in x], request.user),
        )
