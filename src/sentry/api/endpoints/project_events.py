from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from functools import partial

from sentry.api.base import DocSection
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.serializers import EventSerializer, serialize, SimpleEventSerializer
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListProjectAvailableSamples')
def list_project_available_samples_scenario(runner):
    runner.request(
        method='GET',
        path='/projects/%s/%s/events/' % (runner.org.slug, runner.default_project.slug)
    )


class ProjectEventsEndpoint(ProjectEndpoint):
    doc_section = DocSection.EVENTS

    @attach_scenarios([list_project_available_samples_scenario])
    def get(self, request, project):
        """
        List a Project's Events
        ```````````````````````

        Return a list of events bound to a project.

        Note: This endpoint is experimental and may be removed without notice.

        :pparam string organization_slug: the slug of the organization the
                                          groups belong to.
        :pparam string project_slug: the slug of the project the groups
                                     belong to.
        """
        from sentry.api.paginator import GenericOffsetPaginator
        from sentry.models import SnubaEvent
        from sentry.utils.snuba import raw_query

        query = request.GET.get('query')
        conditions = []
        if query:
            conditions.append(
                [['positionCaseInsensitive', ['message', "'%s'" % (query,)]], '!=', 0])

        full = request.GET.get('full', False)
        snuba_cols = SnubaEvent.minimal_columns if full else SnubaEvent.selected_columns
        now = timezone.now()
        data_fn = partial(
            # extract 'data' from raw_query result
            lambda *args, **kwargs: raw_query(*args, **kwargs)['data'],
            start=now - timedelta(days=90),
            end=now,
            conditions=conditions,
            filter_keys={'project_id': [project.id]},
            selected_columns=snuba_cols,
            orderby='-timestamp',
            referrer='api.project-events',
        )

        serializer = EventSerializer() if full else SimpleEventSerializer()
        return self.paginate(
            request=request,
            on_results=lambda results: serialize(
                [SnubaEvent(row) for row in results], request.user, serializer),
            paginator=GenericOffsetPaginator(data_fn=data_fn)
        )
