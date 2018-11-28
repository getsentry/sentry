from __future__ import absolute_import

from django.http import HttpResponseRedirect, Http404
from django.core.urlresolvers import reverse

from sentry.models import Event
from sentry.web.frontend.base import ProjectView


class ProjectEventRedirect(ProjectView):
    required_scope = 'event:read'

    def handle(self, request, organization, project, client_event_id):
        """
        Given a client event id and project, redirects to the event page
        """
        try:
            event = Event.objects.get(
                event_id=client_event_id,
                project_id=project.id)
        except Event.DoesNotExist:
            raise Http404()

        return HttpResponseRedirect(
            reverse(
                'sentry-group-event',
                args=[
                    organization.slug,
                    event.project.slug,
                    event.group_id,
                    event.id])
        )
