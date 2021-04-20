import logging
from typing import Any

from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.external_actor import ExternalActorEndpointMixin, ExternalUserSerializer
from sentry.api.serializers import serialize
from sentry.models import Organization

logger = logging.getLogger(__name__)


class ExternalUserEndpoint(OrganizationEndpoint, ExternalActorEndpointMixin):
    def post(self, request: Any, organization: Organization) -> Response:
        """
        Create an External User
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          user belongs to.
        :param required string provider: enum("github", "gitlab")
        :param required string external_name: the associated Github/Gitlab user name.
        :param required int member_id: the organization_member id.
        :auth: required
        """
        if not self.has_feature(request, organization):
            raise PermissionDenied

        serializer = ExternalUserSerializer(
            context={"organization": organization}, data={**request.data}
        )
        if serializer.is_valid():
            external_user, created = serializer.save()
            status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
            return Response(serialize(external_user, request.user), status=status_code)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
