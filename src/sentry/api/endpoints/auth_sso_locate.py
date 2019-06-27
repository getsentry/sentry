from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _
from rest_framework.response import Response

from sentry.models import AuthProvider, Organization, OrganizationStatus
from sentry.api.base import Endpoint

ERR_NO_SSO = _(
    'The organization does not exist or does not have Single Sign-On enabled.')


class AuthSsoLocateEndpoint(Endpoint):
    # Disable authentication and permission requirements.
    authentication_classes = []
    permission_classes = []

    def get_auth_provider(self, organization_slug):
        try:
            organization = Organization.objects.get(
                slug=organization_slug,
                status=OrganizationStatus.VISIBLE,
            )
        except Organization.DoesNotExist:
            return None

        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
        except AuthProvider.DoesNotExist:
            return None

        return auth_provider

    def post(self, request):
        auth_provider = self.get_auth_provider(request.DATA['organization'])
        if auth_provider:
            next_uri = reverse('sentry-auth-organization',
                               args=[request.DATA['organization']])
            return Response({'nextUri': next_uri})
        else:
            next_uri = request.get_full_path()
            return Response({'detail': ERR_NO_SSO}, status=400)
