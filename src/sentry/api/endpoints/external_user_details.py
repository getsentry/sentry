import logging

from django.http import Http404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import ExternalUser

from .external_user import ExternalUserMixin, ExternalUserSerializer

logger = logging.getLogger(__name__)


class ExternalUserDetailsEndpoint(OrganizationEndpoint, ExternalUserMixin):
    def convert_args(self, request, organization_slug, external_user_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)
        try:
            kwargs["external_user"] = ExternalUser.objects.get(
                id=external_user_id,
            )
        except ExternalUser.DoesNotExist:
            raise Http404

        return (args, kwargs)

    def put(self, request, organization, external_user):
        """
        Update an External User
        `````````````

        :pparam string organization_slug: the slug of the organization the
                                          user belongs to.
        :pparam int user_id: the organization_member id.
        :pparam string external_user_id: id of external_user object
        :param string external_name: the Github/Gitlab user name.
        :param string provider: enum("github","gitlab")
        :auth: required
        """
        if not self.has_feature(request, organization):
            raise PermissionDenied

        serializer = ExternalUserSerializer(
            instance=external_user,
            data=request.data,
            context={"organization": organization},
            partial=True,
        )
        if serializer.is_valid():
            updated_external_user = serializer.save()

            return Response(
                serialize(updated_external_user, request.user), status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, organization, external_user):
        """
        Delete an External Team
        """
        if not self.has_feature(request, organization):
            raise PermissionDenied

        external_user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
