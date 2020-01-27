from __future__ import absolute_import

from rest_framework.response import Response
import six

from sentry.plugins.base import plugins
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.models import ProjectOption


class OrganizationPluginsConfigsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        all_plugins = dict([(p.slug, p) for p in plugins.all()])

        # find all the keys that will tell us if a plugin is enabled OR configured
        keys_to_check = []
        for slug in all_plugins.keys():
            keys_to_check.append("%s:enabled" % slug)
            plugin = all_plugins[slug]
            if plugin.required_field:
                keys_to_check.append("%s:%s" % (slug, plugin.required_field))

        # Get all the project options for org that have truthy values
        project_options = ProjectOption.objects.filter(
            key__in=keys_to_check, project__organization=organization
        ).exclude(value__in=[False, ""])

        # find all unique plugin/project combinations
        projects_by_plugin = {}
        for project_option in project_options:
            slug = project_option.key.split(":")[0]
            if slug not in projects_by_plugin:
                projects_by_plugin[slug] = set()
            projects_by_plugin[slug].add(project_option.project_id)

        serialized_plugins = []
        for slug, plugin in six.iteritems(all_plugins):
            serialized_plugin = serialize(plugin, request.user, PluginSerializer())
            serialized_plugin["count"] = (
                len(projects_by_plugin[slug]) if slug in projects_by_plugin else 0
            )
            serialized_plugins.append(serialized_plugin)

        return Response(serialized_plugins)
