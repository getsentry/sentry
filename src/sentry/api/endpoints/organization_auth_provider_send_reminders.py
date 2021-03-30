from django.utils.translation import ugettext_lazy as _
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationAdminPermission, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import AuthProvider
from sentry.tasks.auth import email_missing_links

ERR_NO_SSO = _("The SSO feature is not enabled for this organization.")


class OrganizationAuthProviderSendRemindersEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAdminPermission,)

    def post(self, request, organization):
        if not features.has("organizations:sso-basic", organization, actor=request.user):
            return Response(ERR_NO_SSO, status=403)

        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
        except AuthProvider.DoesNotExist:
            raise ResourceDoesNotExist

        email_missing_links.delay(organization.id, request.user.id, auth_provider.key)
        return Response(status=200)
