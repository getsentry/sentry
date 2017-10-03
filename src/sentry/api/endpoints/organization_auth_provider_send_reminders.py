from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationAuthProvidersPermission
from sentry.tasks.auth import email_missing_links

ERR_NO_SSO = _('The SSO feature is not enabled for this organization.')


class OrganizationAuthProviderSendRemindersEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAuthProvidersPermission, )

    def post(self, request, organization):
        if not request.user.is_authenticated():
            return Response(status=401)

        if not features.has('organizations:sso', organization, actor=request.user):
            return Response(ERR_NO_SSO, status=403)

        email_missing_links.delay(organization_id=organization.id)
        return Response(status=200)
