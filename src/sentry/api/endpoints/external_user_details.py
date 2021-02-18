import logging
from django.http import Http404

from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import ExternalUser, OrganizationMember

from .external_user import ExternalUserSerializer

logger = logging.getLogger(__name__)


class ExternalUserDetailsEndpoint(OrganizationEndpoint):
    def convert_args(self, request, organization_slug, user_id, external_user_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)
        try:
            kwargs["organization_member"] = OrganizationMember.objects.get(
                id=user_id, organization=kwargs["organization"]
            )
            kwargs["external_user"] = ExternalUser.objects.get(
                id=external_user_id,
            )
        except ExternalUser.DoesNotExist:
            raise Http404

        return (args, kwargs)

    def put(self, request, organization, organization_member, external_user):
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

        serializer = ExternalUserSerializer(
            instance=external_user,
            data={**request.data, "organizationmember_id": organization_member.id},
            partial=True,
        )
        if serializer.is_valid():
            updated_external_user = serializer.save()

            return Response(
                serialize(updated_external_user, request.user), status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, organization, organization_member, external_user):
        """
        Delete an External Team
        """

        external_user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
