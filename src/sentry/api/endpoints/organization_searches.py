from django.db.models import Q
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationSearchPermission
from sentry.api.serializers import serialize
from sentry.models.savedsearch import SavedSearch, SortOptions, Visibility
from sentry.models.search_common import SearchType


class OrganizationSearchSerializer(serializers.Serializer):
    type = serializers.IntegerField(required=True)
    name = serializers.CharField(required=True)
    query = serializers.CharField(required=True, min_length=1)
    sort = serializers.ChoiceField(
        choices=SortOptions.as_choices(), default=SortOptions.DATE, required=False
    )


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
        org_searches_q = Q(Q(owner=request.user) | Q(owner__isnull=True), organization=organization)
        global_searches_q = Q(is_global=True)
        saved_searches = list(
            SavedSearch.objects.filter(org_searches_q | global_searches_q, type=search_type).extra(
                select={"has_owner": "owner_id is not null", "name__upper": "UPPER(name)"},
                order_by=["-has_owner", "name__upper"],
            )
        )

        return Response(serialize(saved_searches, request.user))

    def post(self, request: Request, organization) -> Response:
        serializer = OrganizationSearchSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data
            # Prevent from creating duplicate queries
            if SavedSearch.objects.filter(
                Q(is_global=True) | Q(organization=organization, owner__isnull=True),
                query=result["query"],
            ).exists():
                return Response(
                    {"detail": "Query {} already exists".format(result["query"])}, status=400
                )

            saved_search = SavedSearch.objects.create(
                organization=organization,
                type=result["type"],
                name=result["name"],
                query=result["query"],
                sort=result["sort"],
                # NOTE: We have not yet exposed the API for setting the
                # visibility of a saved search, but we don't want to use
                # the model default of 'owner'. Existing is to be visible
                # to the organization.
                visibility=Visibility.ORGANIZATION,
            )
            analytics.record(
                "organization_saved_search.created",
                search_type=SearchType(saved_search.type).name,
                org_id=organization.id,
                query=saved_search.query,
            )
            return Response(serialize(saved_search, request.user))

        return Response(serializer.errors, status=400)
