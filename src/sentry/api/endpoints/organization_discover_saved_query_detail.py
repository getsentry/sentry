from __future__ import absolute_import

from rest_framework.response import Response
from sentry.api.serializers import serialize
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases import OrganizationEndpoint
from sentry import features
from sentry.models import DiscoverSavedQuery


class OrganizationDiscoverSavedQueryDetailEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission, )

    def get(self, request, organization, query_id):
        """
        Get a saved query
        """
        if not features.has('organizations:discover', organization, actor=request.user):
            return self.respond(status=404)

        try:
            item = DiscoverSavedQuery.objects.get(id=query_id, organization=organization)
        except DiscoverSavedQuery.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(item), status=200)
