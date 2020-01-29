from __future__ import absolute_import

from rest_framework.response import Response
import six

from sentry.plugins.base import plugins
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.models import ProjectOption, Project


# This endpoint is similar to OrganizationPluginsEndpoint
# Eventually we can replace that one with this
class OrganizationPluginsConfigsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        # only load plugins that have configuration
        # plugins that can't be configured shouldn't be shown
        all_plugins = dict([(p.slug, p) for p in plugins.plugins_with_configuration()])

        # can specify specific plugins to load
        if "plugins" in request.GET:
            desired_plugins = request.GET.getlist("plugins")
        else:
            desired_plugins = all_plugins.keys()

        # find all the keys that will tell us if a plugin is enabled OR configured
        keys_to_check = []
        for slug in desired_plugins:
            # if the user request a plugin that doesn't exist, throw 404
            try:
                plugin = plugins.get(slug)
            except KeyError:
                return Response({"detail": "Plugin %s not found" % slug}, status=404)
            keys_to_check.append("%s:enabled" % slug)
            if plugin.required_field:
                keys_to_check.append("%s:%s" % (slug, plugin.required_field))

        # Get all the project options for org that have truthy values
        project_options = ProjectOption.objects.filter(
            key__in=keys_to_check, project__organization=organization
        ).exclude(value__in=[False, ""])

        # This map stores info about whether a plugin is configured and/or enabled
        # the first key is the plugin slug
        # the second slug is the project id
        # the value is an object containing the boolean fields "enabled" and "configured"
        info_by_plugin_project = {}
        for project_option in project_options:
            [slug, field] = project_option.key.split(":")
            project_id = project_option.project_id

            # first add to the set of all projects by plugin
            info_by_plugin_project.setdefault(slug, {}).setdefault(
                project_id, {"enabled": False, "configured": False}
            )

            # next check if enabled
            if field == "enabled":
                info_by_plugin_project[slug][project_id]["enabled"] = True
            # if the projectoption is not the enable field, it's connfiguration field
            else:
                info_by_plugin_project[slug][project_id]["configured"] = True

        # get the IDs of all projects for found project options and grab them from the DB
        project_id_set = set([project_option.project_id for project_option in project_options])
        projects = Project.objects.filter(id__in=project_id_set)

        # create a key/value map of our projects
        project_map = {project.id: project for project in projects}

        # iterate through the desired plugins and serialize them
        serialized_plugins = []
        for slug in desired_plugins:
            plugin = plugins.get(slug)
            serialized_plugin = serialize(plugin, request.user, PluginSerializer())

            serialized_plugin["projectList"] = []

            info_by_project = info_by_plugin_project.get(slug, {})

            # iterate through the projects
            for project_id, plugin_info in six.iteritems(info_by_project):
                project = project_map[project_id]

                # only include plugins which are configured
                if not plugin_info["configured"]:
                    continue

                serialized_plugin["projectList"].append(
                    {
                        "projectId": project.id,
                        "projectSlug": project.slug,
                        "projectName": project.name,  # TODO(steve): do we need?
                        "enabled": plugin_info["enabled"],
                        "configured": plugin_info["configured"],  # TODO(steve): do we need?
                    }
                )
            serialized_plugins.append(serialized_plugin)

        return Response(serialized_plugins)
