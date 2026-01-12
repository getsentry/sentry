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
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationAdminPermission,)

    def convert_args(self, request: Request, api_key_id: str, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]
        try:
            kwargs["api_key"] = ApiKey.objects.get(id=api_key_id, organization_id=organization.id)
        except ApiKey.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def get(self, request: Request, api_key: ApiKey, **kwargs) -> Response:
        """
        Retrieves API Key details
        `````````````````````````

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          team belongs to.
        :pparam string api_key_id: the ID of the api key to delete
        :auth: required
        """
        return Response(serialize(api_key, request.user))

    def put(self, request: Request, api_key: ApiKey, organization, **kwargs) -> Response:
        """
        Update an API Key
        `````````````````

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          team belongs to.
        :pparam string api_key_id: the ID of the api key to delete
        :param string label: the new label for the api key
        :param array scope_list: an array of scopes available for api key
        :param string allowed_origins: list of allowed origins
        :auth: required
        """
        serializer = ApiKeySerializer(api_key, data=request.data, partial=True)

        if serializer.is_valid():
            api_key = serializer.save()

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=api_key.id,
                event=audit_log.get_event_id("APIKEY_EDIT"),
                data=api_key.get_audit_log_data(),
            )

            return Response(serialize(api_key, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request: Request, api_key: ApiKey, organization, **kwargs) -> Response:
        """
        Deletes an API Key
        ``````````````````

        :pparam string organization_id_or_slug: the id or slug of the organization the
                                          team belongs to.
        :pparam string api_key_id: the ID of the api key to delete
        :auth: required
        """
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
