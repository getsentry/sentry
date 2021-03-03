from rest_framework.response import Response

from sentry import analytics
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationSearchPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import SavedSearch
from sentry.models.search_common import SearchType


class OrganizationSearchDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationSearchPermission,)

    def delete(self, request, organization, search_id):
        """
        Delete a saved search

        Permanently remove a saved search.

            {method} {path}

        """
        try:
            search = SavedSearch.objects.get(
                owner__isnull=True, organization=organization, id=search_id
            )
        except SavedSearch.DoesNotExist:
            raise ResourceDoesNotExist

        search.delete()
        analytics.record(
            "organization_saved_search.deleted",
            search_type=SearchType(search.type).name,
            org_id=organization.id,
            query=search.query,
        )
        return Response(status=204)
