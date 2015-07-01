from __future__ import absolute_import, print_function

from sentry.api import client
from sentry.api.base import Endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import Group


class SharedGroupDetailsEndpoint(Endpoint):
    permission_classes = ()

    def get(self, request, share_id):
        """
        Retrieve an aggregate

        Return details on an individual aggregate specified by it's shared ID.

            {method} {path}

        Note: This is not the equivilant of what you'd receive with the standard
        group details endpoint. Data is more restrictive and designed
        specifically for sharing.

        """
        try:
            group = Group.from_share_id(share_id)
        except Group.DoesNotExist:
            raise ResourceDoesNotExist

        # TODO(dcramer): use specific serializer for public group and embed
        # event details as part of api response
        return client.get('/groups/{}/'.format(group.id), request.user, request.auth)
