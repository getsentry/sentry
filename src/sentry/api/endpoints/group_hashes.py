from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import serialize
from sentry.models import Group, GroupHash
from sentry.tasks.unmerge import unmerge
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListAvailableHashes')
def list_available_hashes_scenario(runner):
    group = Group.objects.filter(project=runner.default_project).first()
    runner.request(method='GET', path='/issues/%s/hashes/' % group.id)


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

    def delete(self, request, group):
        id_list = request.GET.getlist('id')
        if id_list is None:
            return Response()

        hash_list = GroupHash.objects.filter(
            project_id=group.project_id,
            group=group.id,
            hash__in=id_list,
        ).exclude(
            state=GroupHash.State.LOCKED_IN_MIGRATION,
        ).values_list(
            'hash', flat=True
        )
        if not hash_list:
            return Response()

        unmerge.delay(
            group.project_id,
            group.id,
            None,
            hash_list,
            request.user.id if request.user else None,
        )

        return Response(status=202)
