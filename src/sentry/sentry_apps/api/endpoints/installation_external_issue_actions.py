from django.utils.functional import empty
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.serializers import serialize
from sentry.sentry_apps.api.bases.sentryapps import SentryAppInstallationBaseEndpoint
from sentry.sentry_apps.api.serializers.platform_external_issue import (
    PlatformExternalIssueSerializer,
)
from sentry.sentry_apps.services.region import sentry_app_region_service
from sentry.users.models.user import User
from sentry.users.services.user.serial import serialize_rpc_user


def _extract_lazy_object(lo):
    """
    Unwrap a LazyObject and return the inner object. Whatever that may be.

    ProTip: This is relying on `django.utils.functional.empty`, which may
    or may not be removed in the future. It's 100% undocumented.
    """
    if not hasattr(lo, "_wrapped"):
        return lo
    if lo._wrapped is empty:
        lo._setup()
    return lo._wrapped


class SentryAppInstallationExternalIssueActionsSerializer(serializers.Serializer):
    groupId = serializers.CharField(required=True, allow_null=False)
    action = serializers.CharField(required=True, allow_null=False)
    uri = serializers.CharField(required=True, allow_null=False)


@control_silo_endpoint
class SentryAppInstallationExternalIssueActionsEndpoint(SentryAppInstallationBaseEndpoint):
    owner = ApiOwner.INTEGRATIONS
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, installation) -> Response:
        data = request.data.copy()

        external_issue_action_serializer = SentryAppInstallationExternalIssueActionsSerializer(
            data=data
        )

        if not external_issue_action_serializer.is_valid():
            return Response(external_issue_action_serializer.errors, status=400)

        group_id = data.pop("groupId")
        action = data.pop("action")
        uri = data.pop("uri")

        user = _extract_lazy_object(request.user)
        if isinstance(user, User):
            user = serialize_rpc_user(user)

        result = sentry_app_region_service.create_issue_link(
            organization_id=installation.organization_id,
            installation=installation,
            group_id=int(group_id),
            action=action,
            fields=data,
            uri=uri,
            user=user,
        )

        if result.error:
            return self.respond_rpc_sentry_app_error(result.error)

        if not result.external_issue:
            return Response({"detail": "Failed to create external issue"}, status=500)

        return Response(
            serialize(objects=result.external_issue, serializer=PlatformExternalIssueSerializer())
        )
