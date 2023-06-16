from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationAdminPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import ApiKey

DEFAULT_SCOPES = ["project:read", "event:read", "team:read", "org:read", "member:read"]


@region_silo_endpoint
class OrganizationApiKeyIndexEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAdminPermission,)

    def get(self, request: Request, organization) -> Response:
        """
        List an Organization's API Keys
        ```````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        queryset = sorted(
            ApiKey.objects.filter(organization_id=organization.id), key=lambda x: x.label
        )

        return Response(serialize(queryset, request.user))

    def post(self, request: Request, organization) -> Response:
        """
        Create an Organization API Key
        ```````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        key = ApiKey.objects.create(organization_id=organization.id, scope_list=DEFAULT_SCOPES)

        self.create_audit_entry(
            request,
            organization=organization,
            target_object=key.id,
            event=audit_log.get_event_id("APIKEY_ADD"),
            data=key.get_audit_log_data(),
        )

        return Response(serialize(key, request.user), status=status.HTTP_201_CREATED)
