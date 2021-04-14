from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationAdminPermission, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import ApiKey, AuditLogEntryEvent


class ApiKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = ApiKey
        fields = ("label", "scope_list", "allowed_origins")


class OrganizationApiKeyDetailsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAdminPermission,)

    def get(self, request, organization, api_key_id):
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

    def put(self, request, organization, api_key_id):
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
                event=AuditLogEntryEvent.APIKEY_EDIT,
                data=api_key.get_audit_log_data(),
            )

            return Response(serialize(api_key, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, organization, api_key_id):
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
            event=AuditLogEntryEvent.APIKEY_REMOVE,
            data=audit_data,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
