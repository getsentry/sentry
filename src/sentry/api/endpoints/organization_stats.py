from __future__ import absolute_import

from rest_framework.response import Response

from sentry.app import tsdb
from sentry.api.base import BaseStatsEndpoint
from sentry.api.permissions import assert_perm
from sentry.models import Organization


class OrganizationStatsEndpoint(BaseStatsEndpoint):
    def get(self, request, organization_id):
        organization = Organization.objects.get_from_cache(id=organization_id)

        assert_perm(organization, request.user, request.auth)

        stat = request.GET.get('stat', 'received')
        if stat == 'received':
            stat_model = tsdb.models.organization_total_received
        elif stat == 'rejected':
            stat_model = tsdb.models.organization_total_rejected
        else:
            raise ValueError('Invalid stat: %s' % stat)

        data = tsdb.get_range(
            model=stat_model,
            keys=[organization.id],
            **self._parse_args(request)
        )[organization.id]

        return Response(data)
