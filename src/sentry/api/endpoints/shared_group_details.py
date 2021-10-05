from rest_framework.response import Response

from sentry.api.base import Endpoint, EnvironmentMixin
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import (
    SharedEventSerializer,
    SharedGroupSerializer,
    SharedProjectSerializer,
    serialize,
)
from sentry.models import Group


class SharedGroupDetailsEndpoint(Endpoint, EnvironmentMixin):
    permission_classes = ()

    def get(self, request, share_id):
        """
        Retrieve an aggregate

        Return details on an individual aggregate specified by it's shared ID.

            {method} {path}

        Note: This is not the equivalent of what you'd receive with the standard
        group details endpoint. Data is more restrictive and designed
        specifically for sharing.

        """
        try:
            group = Group.objects.from_share_id(share_id)
        except Group.DoesNotExist:
            raise ResourceDoesNotExist

        if group.organization.flags.disable_shared_issues:
            raise ResourceDoesNotExist

        event = group.get_latest_event()

        context = serialize(
            group,
            request.user,
            SharedGroupSerializer(
                environment_func=self._get_environment_func(request, group.project.organization_id)
            ),
        )
        # TODO(dcramer): move latestEvent/project into SharedGroupSerializer
        context["latestEvent"] = serialize(event, request.user, SharedEventSerializer())
        context["project"] = serialize(group.project, request.user, SharedProjectSerializer())
        return Response(context)
