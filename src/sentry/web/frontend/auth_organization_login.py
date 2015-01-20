from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse

from sentry.auth.helper import AuthHelper
from sentry.models import Organization
from sentry.web.frontend.base import BaseView


class AuthOrganizationLoginView(BaseView):
    auth_required = False

    def handle(self, request, organization_slug):
        try:
            organization = Organization.objects.get_from_cache(
                slug=organization_slug
            )
        except Organization.DoesNotExist:
            return self.redirect(reverse('sentry-login'))

        auth_provider = organization.auth_provider
        if auth_provider is None:
            return self.redirect(reverse('sentry-login'))

        helper = AuthHelper(request, organization, auth_provider)
        helper.reset_pipeline()
        return helper.next_step()
