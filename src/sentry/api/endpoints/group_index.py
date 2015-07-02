from __future__ import absolute_import, print_function

from rest_framework.response import Response

from sentry.api import client
from sentry.api.base import DocSection, Endpoint
from sentry.models import Group


class GroupIndexEndpoint(Endpoint):
    doc_section = DocSection.EVENTS

    permission_classes = ()

    def get(self, request):
        """
        Retrieve an aggregate

        Return details on an individual aggregate specified by query parameters.

            {method} {path}?shareId=mnIX

        """
        share_id = request.GET.get('shareId')
        if share_id:
            try:
                group = Group.from_share_id(share_id)
            except Group.DoesNotExist:
                group = None
        else:
            group = None

        if not group:
            return Response({'detail': 'No groups found'}, status=404)

        return client.get('/groups/{}/'.format(group.id), request.user, request.auth)
