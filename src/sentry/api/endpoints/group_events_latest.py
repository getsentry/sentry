from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api import client
from sentry.api.base import DocSection
from sentry.api.bases.group import GroupEndpoint
from sentry.models import Group
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('GetLatestGroupSample')
def get_latest_group_sample_scenario(runner):
    project = runner.default_project
    group = Group.objects.filter(project=project).first()
    runner.request(
        method='GET',
        path='/issues/%s/events/latest/' % group.id,
    )


class GroupEventsLatestEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    @attach_scenarios([get_latest_group_sample_scenario])
    def get(self, request, group):
        """
        Latest Sample
        `````````````

        Retrieves the details of the latest sample for an aggregate.

        :pparam string group_id: the ID of the group to get the latest sample of.
        """
        event = group.get_latest_event()
        if not event:
            return Response({'detail': 'No events found for group'}, status=404)

        try:
            return client.get('/events/{}/'.format(event.id), request=request)
        except client.ApiError as e:
            return Response(e.body, status=e.status_code)
