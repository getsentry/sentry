from rest_framework import status
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationAdminPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import ApiKey, AuditLogEntryEvent

DEFAULT_SCOPES = ["project:read", "event:read", "team:read", "org:read", "member:read"]


class OrganizationApiKeyIndexEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAdminPermission,)

    def get(self, request, organization):
        """
        List an Organization's API Keys
        ```````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        queryset = sorted(ApiKey.objects.filter(organization=organization), key=lambda x: x.label)

        return Response(serialize(queryset, request.user))

    def post(self, request, organization):
        """
        Create an Organization API Key
        ```````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        key = ApiKey.objects.create(organization=organization, scope_list=DEFAULT_SCOPES)

        self.create_audit_entry(
            request,
            organization=organization,
            target_object=key.id,
            event=AuditLogEntryEvent.APIKEY_ADD,
            data=key.get_audit_log_data(),
        )

        return Response(serialize(key, request.user), status=status.HTTP_201_CREATED)
