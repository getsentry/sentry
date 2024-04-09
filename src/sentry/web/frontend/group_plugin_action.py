from django.http import Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils.http import url_has_allowed_host_and_scheme
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.serializers.models.plugin import is_plugin_deprecated
from sentry.models.group import Group
from sentry.models.groupmeta import GroupMeta
from sentry.plugins.base import plugins
from sentry.web.frontend.base import ProjectView, region_silo_view


@region_silo_view
class GroupPluginActionView(ProjectView):
    required_scope = "event:read"

    def handle(self, request: Request, organization, project, group_id, slug) -> Response:
        group = get_object_or_404(Group, pk=group_id, project=project)

        try:
            plugin = plugins.get(slug)
            if is_plugin_deprecated(plugin, project):
                raise Http404("Plugin not found")
        except KeyError:
            raise Http404("Plugin not found")

        GroupMeta.objects.populate_cache([group])

        response = plugin.get_view_response(request, group)
        if response:
            return response

        redirect = request.META.get("HTTP_REFERER", "")
        if not url_has_allowed_host_and_scheme(redirect, allowed_hosts=(request.get_host(),)):
            redirect = f"/{organization.slug}/{group.project.slug}/"
        return HttpResponseRedirect(redirect)
