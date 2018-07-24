from __future__ import absolute_import

from rest_framework.response import Response

from sentry.plugins import plugins
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_plugin import OrganizationPluginSerializer
from sentry.models import Project


class OrganizationPluginsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        _plugins = []

        for project in Project.objects.filter(organization=organization):
            for plugin in plugins.configurable_for_project(project, version=None):
                _plugins.append(
                    serialize(
                        plugin,
                        request.user,
                        OrganizationPluginSerializer(project),
                    )
                )

        return Response(_plugins)
