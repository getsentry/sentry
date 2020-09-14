from __future__ import absolute_import

from django.utils import six, timezone
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.models.recentsearch import RecentSearch, remove_excess_recent_searches
from sentry.models.search_common import SearchType


class RecentSearchSerializer(serializers.Serializer):
    type = serializers.IntegerField(required=True)
    query = serializers.CharField(required=True)


class OrganizationRecentSearchPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
    }


class OrganizationRecentSearchesEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationRecentSearchPermission,)

    def get(self, request, organization):
        """
        List recent searches for a User within an Organization
        ``````````````````````````````````````````````````````
        Returns recent searches for a user in a given Organization.

        :auth: required

        """
        try:
            search_type = SearchType(int(request.GET.get("type", 0)))
        except ValueError as e:
            return Response(
                {"detail": "Invalid input for `type`. Error: %s" % six.text_type(e)}, status=400
            )

        try:
            limit = int(request.GET.get("limit", 3))
        except ValueError as e:
            return Response(
                {"detail": "Invalid input for `limit`. Error: %s" % six.text_type(e)}, status=400
            )

        query_kwargs = {"organization": organization, "user": request.user, "type": search_type}

        if "query" in request.GET:
            query_kwargs["query__icontains"] = request.GET["query"]

        recent_searches = list(
            RecentSearch.objects.filter(**query_kwargs).order_by("-last_seen")[:limit]
        )

        return Response(serialize(recent_searches, request.user))

    def post(self, request, organization):
        serializer = RecentSearchSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            created = RecentSearch.objects.create_or_update(
                organization=organization,
                user=request.user,
                type=result["type"],
                query=result["query"],
                values={"last_seen": timezone.now()},
            )[1]
            if created:
                remove_excess_recent_searches(organization, request.user, result["type"])
            status = 201 if created else 204

            return Response("", status=status)
        return Response(serializer.errors, status=400)
