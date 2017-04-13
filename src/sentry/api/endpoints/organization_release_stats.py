from __future__ import absolute_import

from rest_framework.response import Response

from sentry import tsdb
from sentry.api.base import StatsMixin
from sentry.api.bases.organization import OrganizationReleasesBaseEndpoint
from sentry.models import Release


class OrganizationReleaseStatsEndpoint(OrganizationReleasesBaseEndpoint, StatsMixin):
    def get(self, request, organization, version):
        release = Release.objects.get(
            organization=organization,
            version=version,
        )

        data = tsdb.get_range(
            model=tsdb.models.release,
            keys=[release.id],
            **self._parse_args(request)
        )[release.id]

        return Response(data)
