from __future__ import absolute_import

import six
from django.db.models import Case, When
from rest_framework.response import Response

from sentry import features
from sentry.api.serializers import serialize
from sentry.api.bases import OrganizationEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.discover.models import DiscoverSavedQuery
from sentry.discover.endpoints.bases import DiscoverSavedQueryPermission
from sentry.discover.endpoints.serializers import DiscoverSavedQuerySerializer
from sentry.search.utils import tokenize_query


class DiscoverSavedQueriesEndpoint(OrganizationEndpoint):
    permission_classes = (DiscoverSavedQueryPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:discover", organization, actor=request.user
        ) or features.has("organizations:discover-query", organization, actor=request.user)

    def get(self, request, organization):
        """
        List saved queries for organization
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        queryset = (
            DiscoverSavedQuery.objects.filter(organization=organization)
            .select_related("created_by")
            .prefetch_related("projects")
            .extra(select={"lower_name": "lower(name)"})
        )
        query = request.query_params.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == "name" or key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(name__icontains=value)
                elif key == "version":
                    value = " ".join(value)
                    queryset = queryset.filter(version=value)
                else:
                    queryset = queryset.none()

        sort_by = request.query_params.get("sortBy")
        if sort_by in ("name", "-name"):
            order_by = "-lower_name" if sort_by.startswith("-") else "lower_name"
        elif sort_by in ("dateCreated", "-dateCreated"):
            order_by = "-date_created" if sort_by.startswith("-") else "date_created"
        elif sort_by in ("dateUpdated", "-dateUpdated"):
            order_by = "-date_updated" if sort_by.startswith("-") else "date_updated"
        elif sort_by == "myqueries":
            order_by = [
                Case(When(created_by_id=request.user.id, then=-1), default="created_by_id"),
                "lower_name",
            ]
        else:
            order_by = "lower_name"
        if not isinstance(order_by, list):
            order_by = [order_by]
        queryset = queryset.order_by(*order_by)

        # Old discover expects all queries and uses this parameter.
        if request.query_params.get("all") == "1":
            saved_queries = list(queryset.all())
            return Response(serialize(saved_queries), status=200)

        def data_fn(offset, limit):
            return list(queryset[offset : offset + limit])

        return self.paginate(
            request=request,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    def post(self, request, organization):
        """
        Create a saved query
        """
        if not self.has_feature(organization, request):
            return self.respond(status=404)

        serializer = DiscoverSavedQuerySerializer(
            data=request.data,
            context={
                "params": self.get_filter_params(
                    request, organization, project_ids=request.data.get("projects")
                )
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.validated_data

        model = DiscoverSavedQuery.objects.create(
            organization=organization,
            name=data["name"],
            query=data["query"],
            version=data["version"],
            created_by=request.user if request.user.is_authenticated() else None,
        )

        model.set_projects(data["project_ids"])

        return Response(serialize(model), status=201)
