from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import (
    ControlSiloOrganizationEndpoint,
    OrganizationAdminPermission,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.apikey import ApiKey


class ApiKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = ApiKey
        fields = ("label", "scope_list", "allowed_origins")


@control_silo_endpoint
class OrganizationApiKeyDetailsEndpoint(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (OrganizationAdminPermission,)

    def get(self, request: Request, organization_context, organization, api_key_id) -> Response:
        """
        Retrieves API Key details
        `````````````````````````

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string api_key_id: the ID of the api key to delete
        :auth: required
        """
        try:
            api_key = ApiKey.objects.get(id=api_key_id, organization_id=organization.id)
        except ApiKey.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(api_key, request.user))

    def put(self, request: Request, organization_context, organization, api_key_id) -> Response:
        """
        Update an API Key
        `````````````````

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string api_key_id: the ID of the api key to delete
        :param string label: the new label for the api key
        :param array scope_list: an array of scopes available for api key
        :param string allowed_origins: list of allowed origins
        :auth: required
        """

        try:
            api_key = ApiKey.objects.get(id=api_key_id, organization_id=organization.id)
        except ApiKey.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = ApiKeySerializer(api_key, data=request.data, partial=True)

        if serializer.is_valid():
            api_key = serializer.save()

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=api_key_id,
                event=audit_log.get_event_id("APIKEY_EDIT"),
                data=api_key.get_audit_log_data(),
            )

            return Response(serialize(api_key, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request: Request, organization_context, organization, api_key_id) -> Response:
        """
        Deletes an API Key
        ``````````````````

        :pparam string organization_slug: the slug of the organization the
                                          team belongs to.
        :pparam string api_key_id: the ID of the api key to delete
        :auth: required
        """
        try:
            api_key = ApiKey.objects.get(id=api_key_id, organization_id=organization.id)
        except ApiKey.DoesNotExist:
            raise ResourceDoesNotExist

        audit_data = api_key.get_audit_log_data()

        api_key.delete()

        self.create_audit_entry(
            request,
            organization=organization,
            target_object=api_key.id,
            event=audit_log.get_event_id("APIKEY_REMOVE"),
            data=audit_data,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
