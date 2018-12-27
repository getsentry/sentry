from __future__ import absolute_import

from rest_framework import serializers

from sentry.models import Project
from sentry.relay import config
from sentry.relay.queries.base import BaseQuery, InvalidQuery


class GetProjectConfigSerializer(serializers.Serializer):
    project_id = serializers.IntegerField(required=True)


class GetProjectConfig(BaseQuery):

    def preprocess(self, query):
        serializer = GetProjectConfigSerializer(data=query)
        if not serializer.is_valid():
            raise InvalidQuery(str(serializer.errors).splitlines()[0])

        result = serializer.object

        try:
            project = Project.objects.filter(
                id=result.get('project_id'),
            ).get()
        except Project.DoesNotExist:
            raise InvalidQuery('Project does not exist')

        self.project = project

    def execute(self):
        if not self.relay.has_org_access(self.project.organization):
            return None
        return config.get_project_options(self.project)
