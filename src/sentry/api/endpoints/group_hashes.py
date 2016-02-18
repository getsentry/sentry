from __future__ import absolute_import

from sentry.api.base import DocSection
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import Group, GroupHash
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListAvailableHashes')
def list_available_hashes_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(
        method='GET',
        path='/issues/%s/hashes/' % group.id
    )


class GroupHashesEndpoint(GroupEndpoint):
    doc_section = DocSection.EVENTS

    @attach_scenarios([list_available_hashes_scenario])
    def get(self, request, group):
        """
        List an Issue's Hashes
        ``````````````````````

        This endpoint lists an issue's hashes, which are the generated
        checksums used to aggregate individual events.

        :pparam string issue_id: the ID of the issue to retrieve.
        :auth: required
        """

        queryset = GroupHash.objects.filter(
            group=group.id,
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='id',
            on_results=lambda x: serialize(x, request.user),
        )
