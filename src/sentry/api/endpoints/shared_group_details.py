from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, EnvironmentMixin, region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import SharedGroupSerializer, serialize
from sentry.models.group import Group


@region_silo_endpoint
class SharedGroupDetailsEndpoint(Endpoint, EnvironmentMixin):
    owner = ApiOwner.ISSUES
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = ()

    def get(
        self, request: Request, organization_slug: str | None = None, share_id: str | None = None
    ) -> Response:
        """
        Retrieve an aggregate

        Return details on an individual aggregate specified by it's shared ID.

            {method} {path}

        Note: This is not the equivalent of what you'd receive with the standard
        group details endpoint. Data is more restrictive and designed
        specifically for sharing.

        """
        if share_id is None:
            raise ResourceDoesNotExist

        try:
            group = Group.objects.from_share_id(share_id)
        except Group.DoesNotExist:
            raise ResourceDoesNotExist

        if organization_slug:
            if organization_slug != group.organization.slug:
                raise ResourceDoesNotExist

        if group.organization.flags.disable_shared_issues:
            raise ResourceDoesNotExist

        context = serialize(
            group,
            request.user,
            SharedGroupSerializer(
                environment_func=self._get_environment_func(request, group.project.organization_id)
            ),
        )
        return Response(context)
