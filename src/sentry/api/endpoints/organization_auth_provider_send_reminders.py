from django.utils.translation import gettext_lazy as _
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk import capture_message, push_scope

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationAdminPermission, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.authprovider import AuthProvider
from sentry.tasks.auth import email_missing_links

ERR_NO_SSO = _("The SSO feature is not enabled for this organization.")


@region_silo_endpoint
class OrganizationAuthProviderSendRemindersEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.UNKNOWN,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (OrganizationAdminPermission,)

    def post(self, request: Request, organization) -> Response:
        if not features.has("organizations:sso-basic", organization, actor=request.user):
            return Response(ERR_NO_SSO, status=403)

        # This endpoint looks unused. Capture any requests this endpoint receives
        with push_scope() as scope:
            scope.set_level("info")
            capture_message("AuthProvidersSendReminder accessed")

        try:
            auth_provider = AuthProvider.objects.get(organization_id=organization.id)
        except AuthProvider.DoesNotExist:
            raise ResourceDoesNotExist

        email_missing_links.delay(organization.id, request.user.id, auth_provider.key)
        return Response(status=200)
