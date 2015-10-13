from __future__ import absolute_import, division

from django.core.urlresolvers import reverse
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import get_object_or_404

from sentry.models import Group, GroupMeta
from sentry.plugins import plugins
from sentry.web.frontend.base import ProjectView


class GroupPluginActionView(ProjectView):
    required_scope = 'event:read'

    def handle(self, request, organization, team, project, group_id, slug):
        group = get_object_or_404(Group, pk=group_id, project=project)

        try:
            plugin = plugins.get(slug)
        except KeyError:
            raise Http404('Plugin not found')

        GroupMeta.objects.populate_cache([group])

        response = plugin.get_view_response(request, group)
        if response:
            return response

        redirect = request.META.get('HTTP_REFERER') or reverse('sentry-stream', kwargs={
            'organization_slug': organization.slug,
            'project_id': group.project.slug
        })
        return HttpResponseRedirect(redirect)
