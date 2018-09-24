from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ListField


from sentry.api.bases.organization import OrganizationPermission
from sentry.api.bases import OrganizationEndpoint
from sentry.models import DiscoverSavedQuery

from sentry import features


class DiscoverSavedQueriesSerializer(serializers.Serializer):
    name = serializers.CharField(required=True)
    projects = ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_null=True,
        default=[]
    )
    start = serializers.DateTimeField(required=False)
    end = serializers.DateTimeField(required=False)
    range = serializers.CharField(required=False)
    fields = ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
    )
    limit = serializers.IntegerField(min_value=0, max_value=1000, required=False)
    rollup = serializers.IntegerField(required=False)
    orderby = serializers.CharField(required=False)
    conditions = ListField(
        child=ListField(),
        required=False,
        allow_null=True,
    )
    aggregations = ListField(
        child=ListField(),
        required=False,
        allow_null=True,
        default=[]
    )
    groupby = ListField(
        child=serializers.CharField(),
        required=False,
        allow_null=True,
    )

    def validate(self, data):
        query = {}
        query_keys = [
            'fields',
            'conditions',
            'aggregations',
            'range',
            'start',
            'end',
            'orderby',
            'limit'
        ]

        for key in query_keys:
            if data.get(key) is not None:
                query[key] = data[key]

        return {
            'name': data['name'],
            'project_ids': data['projects'],
            'query': query,
        }


class OrganizationDiscoverSavedQueriesEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationPermission, )

    def get(self, request, organization):
        """
        List saved queries for organization
        """
        if not features.has('organizations:discover', organization, actor=request.user):
            return self.respond(status=404)

        saved_queries = list(DiscoverSavedQuery.objects.filter(
            organization=organization,
        ).all().prefetch_related('projects').order_by('name'))

        return Response(serialize(saved_queries), status=200)

    def post(self, request, organization):
        """
        Create a saved query
        """
        if not features.has('organizations:discover', organization, actor=request.user):
            return self.respond(status=404)

        serializer = DiscoverSavedQueriesSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        data = serializer.object

        model = DiscoverSavedQuery.objects.create(
            organization=organization,
            name=data['name'],
            query=data['query'],
            created_by=request.user,
        )

        model.add_projects(data['project_ids'])

        return Response(serialize(model), status=201)
