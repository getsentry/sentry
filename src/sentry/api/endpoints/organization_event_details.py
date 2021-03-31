from rest_framework.response import Response

from sentry import eventstore
from sentry.api.bases import OrganizationEventsEndpointBase
from sentry.api.serializers import serialize
from sentry.models.project import Project, ProjectStatus


class OrganizationEventDetailsEndpoint(OrganizationEventsEndpointBase):
    def get(self, request, organization, project_slug, event_id):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            project = Project.objects.get(
                slug=project_slug, organization_id=organization.id, status=ProjectStatus.VISIBLE
            )
        except Project.DoesNotExist:
            return Response(status=404)

        # Check access to the project as this endpoint doesn't use membership checks done
        # get_filter_params().
        if not request.access.has_project_access(project):
            return Response(status=404)

        # We return the requested event if we find a match regardless of whether
        # it occurred within the range specified
        with self.handle_query_errors():
            event = eventstore.get_event_by_id(project.id, event_id)

        if event is None:
            return Response({"detail": "Event not found"}, status=404)

        data = serialize(event)
        data["projectSlug"] = project_slug

        return Response(data)
