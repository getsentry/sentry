from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import Environment


class OrganizationEnvironmentsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        queryset = Environment.objects.filter(
            organization_id=organization.id,
        ).exclude(
            # HACK(mattrobenolt): We don't want to surface the
            # "No Environment" environment to the UI since it
            # doesn't really exist. This might very likely change
            # with new tagstore backend in the future, but until
            # then, we're hiding it since it causes more problems
            # than it's worth.
            name='',
        ).order_by('name')
        return Response(serialize(list(queryset), request.user))
