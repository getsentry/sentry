from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationSearchPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework.savedsearch import (
    OrganizationSearchAdminSerializer,
    OrganizationSearchMemberSerializer,
)
from sentry.models.savedsearch import SavedSearch, Visibility
from sentry.models.search_common import SearchType


@region_silo_endpoint
class OrganizationSearchesEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationSearchPermission,)

    def get(self, request: Request, organization) -> Response:
        """
        List an Organization's saved searches
        `````````````````````````````````````
        Retrieve a list of saved searches for a given Organization. For custom
        saved searches, return them for all projects even if we have duplicates.
        For default searches, just return one of each search

        :auth: required

        """
        try:
            search_type = SearchType(int(request.GET.get("type", 0)))
        except ValueError as e:
            return Response({"detail": "Invalid input for `type`. Error: %s" % str(e)}, status=400)

        query = (
            SavedSearch.objects
            # Do not include pinned or personal searches from other users in
            # the same organization. DOES include the requesting users pinned
            # search
            .exclude(
                ~Q(owner_id=request.user.id),
                visibility__in=(Visibility.OWNER, Visibility.OWNER_PINNED),
            )
            .filter(
                Q(organization=organization) | Q(is_global=True),
                type=search_type,
            )
            .extra(order_by=["name"])
        )

        return Response(serialize(list(query), request.user))

    def post(self, request: Request, organization) -> Response:
        if request.access.has_scope("org:write"):
            serializer = OrganizationSearchAdminSerializer(data=request.data)
        else:
            serializer = OrganizationSearchMemberSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        if result["visibility"] == Visibility.ORGANIZATION:
            # Check for conflicts against existing org searches
            if SavedSearch.objects.filter(
                is_global=False,
                organization=organization,
                type=SearchType.ISSUE.value,
                visibility=Visibility.ORGANIZATION,
                query=result["query"],
            ).exists():
                return Response(
                    {"detail": f"An organization search for '{result['query']}' already exists"},
                    status=400,
                )
        elif result["visibility"] == Visibility.OWNER:
            # Check for conflicts against the user's searches
            if SavedSearch.objects.filter(
                is_global=False,
                organization=organization,
                type=SearchType.ISSUE.value,
                visibility=Visibility.OWNER,
                owner_id=request.user.id,
                query=result["query"],
            ).exists():
                return Response(
                    {"detail": f"A search for '{result['query']}' already exists"},
                    status=400,
                )

        saved_search = SavedSearch.objects.create(
            organization=organization,
            owner_id=request.user.id,
            type=result["type"],
            name=result["name"],
            query=result["query"],
            sort=result["sort"],
            visibility=result["visibility"],
        )
        analytics.record(
            "organization_saved_search.created",
            search_type=SearchType(saved_search.type).name,
            org_id=organization.id,
            query=saved_search.query,
        )
        return Response(serialize(saved_search, request.user))
