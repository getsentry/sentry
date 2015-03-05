from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse

from sentry.auth.helper import AuthHelper
from sentry.models import AuthProvider, Organization
from sentry.web.frontend.base import BaseView


class AuthOrganizationLoginView(BaseView):
    auth_required = False

    def handle(self, request, organization_slug):
        try:
            organization = Organization.objects.get(
                slug=organization_slug
            )
        except Organization.DoesNotExist:
            return self.redirect(reverse('sentry-login'))

        try:
            auth_provider = AuthProvider.objects.get(
                organization=organization
            )
        except AuthProvider.DoesNotExist:
            return self.redirect(reverse('sentry-login'))

        if request.method == 'POST':
            helper = AuthHelper(
                request=request,
                organization=organization,
                auth_provider=auth_provider,
                flow=AuthHelper.FLOW_LOGIN,
            )
            helper.init_pipeline()
            return helper.next_step()

        provider = auth_provider.get_provider()

        context = {
            'organization': organization,
            'provider_key': provider.key,
            'provider_name': provider.name,
        }

        return self.respond('sentry/organization-login.html', context)
