from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.paginator import DateTimePaginator
from sentry.models import Event
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListProjectAvailableSamples')
def list_project_available_samples_scenario(runner):
    runner.request(
        method='GET',
        path='/projects/%s/%s/events/' % (
            runner.org.slug, runner.default_project.slug)
    )


class ProjectEventsEndpoint(ProjectEndpoint):
    doc_section = DocSection.EVENTS

    @attach_scenarios([list_project_available_samples_scenario])
    def get(self, request, project):
        """
        List a Project's Available Samples
        ``````````````````````````````````

        Return a list of sampled events bound to a project.

        :pparam string organization_slug: the slug of the organization the
                                          groups belong to.
        :pparam string project_slug: the slug of the project the groups
                                     belong to.
        """

        events = Event.objects.filter(
            project_id=project.id,
        )

        query = request.GET.get('query')
        if query:
            events = events.filter(
                message__icontains=query,
            )

        return self.paginate(
            request=request,
            queryset=events,
            order_by='-datetime',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=DateTimePaginator,
        )
