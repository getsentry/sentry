import logging

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.external_actor import ExternalActorEndpointMixin, ExternalUserSerializer
from sentry.api.serializers import serialize
from sentry.models import Organization

logger = logging.getLogger(__name__)


class ExternalUserEndpoint(OrganizationEndpoint, ExternalActorEndpointMixin):  # type: ignore
    def post(self, request: Request, organization: Organization) -> Response:
        """
        Create an External User
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          user belongs to.
        :param required string provider: enum("github", "gitlab", "slack")
        :param required string external_name: the associated username for this provider.
        :param required int user_id: the User ID in Sentry.
        :param string external_id: the associated user ID for this provider
        :auth: required
        """
        self.assert_has_feature(request, organization)

        serializer = ExternalUserSerializer(
            data=request.data, context={"organization": organization}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        external_user, created = serializer.save()
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(serialize(external_user, request.user, key="user"), status=status_code)
