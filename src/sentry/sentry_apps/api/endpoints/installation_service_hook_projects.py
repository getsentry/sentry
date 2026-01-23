from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers.base import serialize
from sentry.auth.services.auth.model import AuthenticationContext
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.api.serializers.servicehookproject import ServiceHookProjectSerializer
from sentry.sentry_apps.services.app.model import RpcSentryAppInstallation
from sentry.sentry_apps.services.region import sentry_app_region_service
from sentry.users.services.user.serial import serialize_generic_user


class ServiceHookProjectsInputSerializer(serializers.Serializer):
    projects = serializers.ListField(required=True)

    def validate_projects(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Projects must be a list, not %s" % type(value).__name__
            )

        if not value:
            raise serializers.ValidationError("Projects list cannot be empty")

        # Check the type of the first element to determine expected type
        first_elem = value[0]

        if not isinstance(first_elem, (str, int)):
            raise serializers.ValidationError(
                "Project identifiers must be either all strings (slugs) or all integers (IDs)"
            )

        expected_type = type(first_elem)

        # Verify all elements are of the same type
        if not all(isinstance(x, expected_type) for x in value):
            raise serializers.ValidationError(
                "Mixed types detected. All project identifiers must be of the same type "
                "(either all strings/slugs or all integers/IDs)"
            )

        return value


@control_silo_endpoint
class SentryAppInstallationServiceHookProjectsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def _get_auth_context(self, request: Request) -> AuthenticationContext:
        return AuthenticationContext(
            auth=getattr(request, "auth", None),
            user=serialize_generic_user(request.user),
        )

    def get(self, request: Request, installation: RpcSentryAppInstallation) -> Response:
        result = sentry_app_region_service.get_service_hook_projects(
            organization_id=installation.organization_id,
            installation=installation,
            auth_context=self._get_auth_context(request),
        )
        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        return Response(
            serialize(
                result.service_hook_projects,
                request.user,
                access=request.access,
                serializer=ServiceHookProjectSerializer(),
            )
        )

    """
        POST will replace all existing project filters with the new set.
    """

    def post(self, request: Request, installation: RpcSentryAppInstallation) -> Response:

        serializer = ServiceHookProjectsInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        projects = serializer.validated_data["projects"]
        result = sentry_app_region_service.set_service_hook_projects(
            organization_id=installation.organization_id,
            installation=installation,
            project_identifiers=projects,
            auth_context=self._get_auth_context(request),
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        return Response(
            serialize(
                result.service_hook_projects,
                request.user,
                access=request.access,
                serializer=ServiceHookProjectSerializer(),
            )
        )

    def delete(self, request: Request, installation: RpcSentryAppInstallation) -> Response:
        result = sentry_app_region_service.delete_service_hook_projects(
            organization_id=installation.organization_id,
            installation=installation,
            auth_context=self._get_auth_context(request),
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        return Response(status=204)
