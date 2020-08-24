from __future__ import absolute_import

from rest_framework.response import Response
import six

from sentry.constants import ObjectStatus
from sentry.plugins.base import plugins
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.models import ProjectOption, Project


class OrganizationPluginsConfigsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):

        """
        List one or more plugin configurations, including a `projectList` for each plugin which contains
        all the projects that have that specific plugin both configured and enabled.

        - similar to the `OrganizationPluginsEndpoint`, and can eventually replace it

        :qparam plugins array[string]: an optional list of plugin ids (slugs) if you want specific plugins.
                                    If not set, will return configurations for all plugins.
        """

        desired_plugins = []
        for slug in request.GET.getlist("plugins") or ():
            # if the user request a plugin that doesn't exist, throw 404
            try:
                desired_plugins.append(plugins.get(slug))
            except KeyError:
                return Response({"detail": "Plugin %s not found" % slug}, status=404)

        # if no plugins were specified, grab all plugins but limit by those that have the ability to be configured
        if not desired_plugins:
            desired_plugins = list(plugins.plugin_that_can_be_configured())

        # `keys_to_check` are the ProjectOption keys that tell us if a plugin is enabled (e.g. `plugin:enabled`) or are
        # configured properly, meaning they have the required information - plugin.required_field - needed for the
        # plugin to work (ex:`opsgenie:api_key`)
        keys_to_check = []
        for plugin in desired_plugins:
            keys_to_check.append("%s:enabled" % plugin.slug)
            if plugin.required_field:
                keys_to_check.append("%s:%s" % (plugin.slug, plugin.required_field))

        # Get all the project options for org that have truthy values
        project_options = ProjectOption.objects.filter(
            key__in=keys_to_check, project__organization=organization
        ).exclude(value__in=[False, ""])

        """
        This map stores info about whether a plugin is configured and/or enabled
        {
            "plugin_slug": {
                "project_id": { "enabled": True, "configured": False },
            },
        }
        """
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
            # if the projectoption is not the enable field, it's configuration field
            else:
                info_by_plugin_project[slug][project_id]["configured"] = True

        # get the IDs of all projects for found project options and grab them from the DB
        project_id_set = set([project_option.project_id for project_option in project_options])
        projects = Project.objects.filter(id__in=project_id_set, status=ObjectStatus.VISIBLE)

        # create a key/value map of our projects
        project_map = {project.id: project for project in projects}

        # iterate through the desired plugins and serialize them
        serialized_plugins = []
        for plugin in desired_plugins:
            serialized_plugin = serialize(plugin, request.user, PluginSerializer())

            serialized_plugin["projectList"] = []

            info_by_project = info_by_plugin_project.get(plugin.slug, {})

            # iterate through the projects
            for project_id, plugin_info in six.iteritems(info_by_project):
                # if the project is being deleted
                if project_id not in project_map:
                    continue
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
                        "projectPlatform": project.platform,
                    }
                )
            # sort by the projectSlug
            serialized_plugin["projectList"].sort(key=lambda x: x["projectSlug"])
            serialized_plugins.append(serialized_plugin)

        return Response(serialized_plugins)
