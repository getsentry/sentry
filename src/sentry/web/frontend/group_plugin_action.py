from django.http import Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.utils.http import is_safe_url
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.serializers.models.plugin import is_plugin_deprecated
from sentry.models import Group, GroupMeta
from sentry.plugins.base import plugins
from sentry.web.frontend.base import ProjectView


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
        if not is_safe_url(redirect, allowed_hosts=(request.get_host(),)):
            redirect = f"/{organization.slug}/{group.project.slug}/"
        return HttpResponseRedirect(redirect)
