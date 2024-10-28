from django.http import Http404, HttpRequest, HttpResponseRedirect
from django.urls import reverse

from sentry import eventstore
from sentry.web.frontend.base import ProjectView, region_silo_view


@region_silo_view
class ProjectEventRedirect(ProjectView):
    required_scope = "event:read"

    def handle(
        self, request: HttpRequest, organization, project, client_event_id
    ) -> HttpResponseRedirect:
        """
        Given a client event id and project, redirects to the event page
        """
        event = eventstore.backend.get_event_by_id(project.id, client_event_id)

        if event is None:
            raise Http404

        if not event.group_id:
            raise Http404

        path = reverse(
            "sentry-organization-event-detail",
            args=[organization.slug, event.group_id, event.event_id],
        )
        return HttpResponseRedirect(organization.absolute_url(path))
