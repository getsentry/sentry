from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_plugin import OrganizationPluginSerializer
from sentry.api.serializers.models.plugin import PluginSerializer
from sentry.models import ProjectOption
from sentry.plugins.base import plugins


class OrganizationPluginsEndpoint(OrganizationEndpoint):
    def get(self, request, organization):
        all_plugins = {p.slug: p for p in plugins.all()}

        if "plugins" in request.GET:
            if request.GET.get("plugins") == "_all":
                return Response(
                    serialize([p for p in plugins.all()], request.user, PluginSerializer())
                )

            desired_plugins = set(request.GET.getlist("plugins"))
        else:
            desired_plugins = set(all_plugins.keys())

        # Ignore plugins that are not available to this Sentry install.
        desired_plugins = desired_plugins & set(all_plugins.keys())

        # Each tuple represents an enabled Plugin (of only the ones we care
        # about) and its corresponding Project.
        enabled_plugins = ProjectOption.objects.filter(
            key__in=["%s:enabled" % slug for slug in desired_plugins],
            project__organization=organization,
        ).select_related("project")

        resources = []

        for project_option in enabled_plugins:
            resources.append(
                serialize(
                    all_plugins[project_option.key.split(":")[0]],
                    request.user,
                    OrganizationPluginSerializer(project_option.project),
                )
            )

        return Response(resources)
