from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationSearchPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.savedsearch import OrganizationSearchSerializer
from sentry.models.organization import Organization
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.models.search_common import SearchType


@region_silo_endpoint
class OrganizationSearchDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationSearchPermission,)

    def convert_args(self, request: Request, organization_slug, search_id, *args, **kwargs):
        (args, kwargs) = super().convert_args(request, organization_slug, *args, **kwargs)

        try:
            # Only allow users to delete their own personal searches OR
            # organization level searches
            org_search = Q(visibility=Visibility.ORGANIZATION)
            personal_search = Q(owner=request.user, visibility=Visibility.OWNER)

            kwargs["search"] = SavedSearch.objects.get(
                org_search | personal_search,
                organization=kwargs["organization"],
                id=search_id,
            )
        except SavedSearch.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def put(self, request: Request, organization: Organization, search: SavedSearch) -> Response:
        """
        Updates a saved search
        """
        serializer = OrganizationSearchSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        if (
            SavedSearch.objects
            # Query duplication for pinned searches is fine, exlcuded these
            .exclude(visibility=Visibility.OWNER_PINNED)
            .filter(Q(is_global=True) | Q(organization=organization), query=result["query"])
            .exists()
        ):
            return Response(
                {"detail": "Query {} already exists".format(result["query"])}, status=400
            )

        search.update(**result)
        return Response(serialize(search, request.user))

    def delete(self, request: Request, organization: Organization, search: SavedSearch) -> Response:
        """
        Permanently remove a saved search.
        """
        search.delete()
        analytics.record(
            "organization_saved_search.deleted",
            search_type=SearchType(search.type).name,
            org_id=organization.id,
            query=search.query,
        )
        return Response(status=204)
