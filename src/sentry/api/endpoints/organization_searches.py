from django.db.models import Q
from rest_framework import serializers
from rest_framework.response import Response

from sentry import analytics
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationSearchPermission
from sentry.api.serializers import serialize
from sentry.models.savedsearch import SavedSearch, SortOptions
from sentry.models.search_common import SearchType


class OrganizationSearchSerializer(serializers.Serializer):
    type = serializers.IntegerField(required=True)
    name = serializers.CharField(required=True)
    query = serializers.CharField(required=True, min_length=1)
    sort = serializers.ChoiceField(
        choices=SortOptions.as_choices(), default=SortOptions.DATE, required=False
    )


class OrganizationSearchesEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationSearchPermission,)

    def get(self, request, organization):
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
        results = []
        if saved_searches:
            pinned_search = None
            # If the saved search has an owner then it's the user's pinned
            # search. The user can only have one pinned search.
            results.append(saved_searches[0])
            if saved_searches[0].is_pinned:
                pinned_search = saved_searches[0]
            for saved_search in saved_searches[1:]:
                # If a search has the same query and sort as the pinned search we
                # want to use that search as the pinned search
                if (
                    pinned_search
                    and saved_search.query == pinned_search.query
                    and saved_search.sort == pinned_search.sort
                ):
                    saved_search.is_pinned = True
                    results[0] = saved_search
                else:
                    results.append(saved_search)

        return Response(serialize(results, request.user))

    def post(self, request, organization):
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
            )
            analytics.record(
                "organization_saved_search.created",
                search_type=SearchType(saved_search.type).name,
                org_id=organization.id,
                query=saved_search.query,
            )
            return Response(serialize(saved_search, request.user))
        return Response(serializer.errors, status=400)
