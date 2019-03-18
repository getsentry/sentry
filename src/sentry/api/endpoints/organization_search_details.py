from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationSearchPermission,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import SavedSearch


class OrganizationSearchDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationSearchPermission, )

    def delete(self, request, organization, search_id):
        """
        Delete a saved search

        Permanently remove a saved search.

            {method} {path}

        """
        try:
            search = SavedSearch.objects.get(
                owner__isnull=True,
                organization=organization,
                id=search_id,
            )
        except SavedSearch.DoesNotExist:
            raise ResourceDoesNotExist

        search.delete()
        return Response(status=204)
