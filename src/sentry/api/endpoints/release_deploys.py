from __future__ import absolute_import

from rest_framework.exceptions import PermissionDenied

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Deploy, Release


class ReleaseDeploysEndpoint(OrganizationReleasesBaseEndpoint):
    doc_section = DocSection.RELEASES

    def get(self, request, organization, version):
        """
        List a Release's Deploys
        ````````````````````````
        Return a list of deploys for a given release.
        :pparam string organization_slug: the organization short name
        :pparam string version: the version identifier of the release.

        """
        try:
            release = Release.objects.get(
                version=version,
                organization=organization
            )
        except Release.DoesNotExist:
            raise ResourceDoesNotExist

        allowed_projects = set(
            self.get_allowed_projects(
                request,
                organization
            ).values_list('id', flat=True)
        )

        # make sure user has access to at least one project
        # in release
        if not [p for p in release.projects.values_list('id', flat=True) if p in allowed_projects]:
            raise PermissionDenied

        queryset = Deploy.objects.filter(
            organization_id=organization.id,
            release=release
        ).extra(select={
            'sort': 'COALESCE(date_finished, date_started)',
        })

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='-sort',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
