from __future__ import absolute_import

from sentry.api.bases.organization import OrganizationDiscoverPermission
from sentry.api.bases import OrganizationEndpoint
from sentry.models import DiscoverSavedQuery

from sentry.api.serializers import serialize
from rest_framework.response import Response

from sentry import features


class OrganizationDiscoverSavedQueriesEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDiscoverPermission, )

    def get(self, request, organization):
        """
        List saved queries for organization
        """
        if not features.has('organizations:discover', organization, actor=request.user):
            return self.respond(status=404)

        saved_queries = list(
            DiscoverSavedQuery.objects.filter(
                organization=organization,
            ).order_by('name')
        )

        return Response(serialize(saved_queries), status=200)
