import logging
from typing import Any, Tuple

from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.external_actor import ExternalActorEndpointMixin, ExternalUserSerializer
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import ExternalActor, Organization

logger = logging.getLogger(__name__)


class ExternalUserDetailsEndpoint(OrganizationEndpoint, ExternalActorEndpointMixin):
    def convert_args(self, request: Any, *args: Any, **kwargs: Any) -> Tuple[Any, Any]:
        """ A little magic to make types work for convert_args. """
        return self._convert_args(request, *args, **kwargs)

    def _convert_args(
        self, request: Any, organization_slug: str, external_user_id: int, *args: Any, **kwargs: Any
    ) -> Tuple[Any, Any]:
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)
        kwargs["external_user"] = self.get_external_actor_or_404(external_user_id)
        return args, kwargs

    def put(self, request: Any, organization: Organization, external_user: ExternalActor):
        """
        Update an External User
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          user belongs to.
        :pparam int user_id: the User id.
        :pparam string external_user_id: id of external_user object
        :param string external_name: the Github/Gitlab user name.
        :param string provider: enum("github","gitlab")
        :auth: required
        """
        self.assert_has_feature(request, organization)

        serializer = ExternalUserSerializer(
            external_user,
            request.data,
            context={"organization": organization},
            partial=True,
        )
        if serializer.is_valid():
            updated_external_user = serializer.save()

            return Response(
                serialize(updated_external_user, request.user), status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request: Any, organization: Organization, external_user: ExternalActor):
        """
        Delete an External Team
        """
        self.assert_has_feature(request, organization)

        external_user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
