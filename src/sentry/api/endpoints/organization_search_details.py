from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationSearchPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.savedsearch import (
    OrganizationSearchAdminSerializer,
    OrganizationSearchMemberSerializer,
)
from sentry.models.organization import Organization
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.models.search_common import SearchType


class OrganizationSearchEditPermission(OrganizationSearchPermission):
    """
    Includes object permission check to disallow users without org:write from
    mutating Visibility.ORGANIZATION searches.
    """

    def has_object_permission(self, request: Request, view, obj):
        if isinstance(obj, Organization):
            return super().has_object_permission(request, view, obj)

        if isinstance(obj, SavedSearch):
            return (
                request.access.has_scope("org:write") or obj.visibility != Visibility.ORGANIZATION
            )


@region_silo_endpoint
class OrganizationSearchDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationSearchEditPermission,)

    def convert_args(self, request: Request, organization_slug, search_id, *args, **kwargs):
        (args, kwargs) = super().convert_args(request, organization_slug, *args, **kwargs)

        # Only allow users to delete their own personal searches OR
        # organization level searches
        org_search = Q(visibility=Visibility.ORGANIZATION)
        personal_search = Q(owner_id=request.user.id, visibility=Visibility.OWNER)

        try:
            search = SavedSearch.objects.get(
                org_search | personal_search,
                organization=kwargs["organization"],
                id=search_id,
            )
        except SavedSearch.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, search)
        kwargs["search"] = search

        return (args, kwargs)

    def put(self, request: Request, organization: Organization, search: SavedSearch) -> Response:
        """
        Updates a saved search
        """
        if request.access.has_scope("org:write"):
            serializer = OrganizationSearchAdminSerializer(data=request.data)
        else:
            serializer = OrganizationSearchMemberSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        if (
            SavedSearch.objects
            # Query duplication for pinned searches is fine, exlcuded these
            .exclude(visibility=Visibility.OWNER_PINNED)
            .exclude(id=search.id)
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
