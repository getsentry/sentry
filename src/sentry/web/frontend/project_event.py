from __future__ import absolute_import

from django.http import HttpResponseRedirect, Http404
from django.core.urlresolvers import reverse

from sentry import eventstore
from sentry.web.frontend.base import ProjectView


class ProjectEventRedirect(ProjectView):
    required_scope = "event:read"

    def handle(self, request, organization, project, client_event_id):
        """
        Given a client event id and project, redirects to the event page
        """
        event = eventstore.get_event_by_id(project.id, client_event_id)

        if event is None:
            raise Http404

        if not event.group_id:
            raise Http404

        return HttpResponseRedirect(
            reverse(
                "sentry-organization-event-detail",
                args=[organization.slug, event.group_id, event.event_id],
            )
        )
