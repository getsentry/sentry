from django.http import Http404, HttpResponseRedirect
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.web.frontend.base import ProjectView


class ProjectEventRedirect(ProjectView):
    required_scope = "event:read"

    def handle(self, request: Request, organization, project, client_event_id) -> Response:
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
