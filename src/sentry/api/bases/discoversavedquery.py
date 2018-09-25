from __future__ import absolute_import
from rest_framework import serializers
from sentry.api.serializers.rest_framework import ListField


class DiscoverSavedQuerySerializer(serializers.Serializer):
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
