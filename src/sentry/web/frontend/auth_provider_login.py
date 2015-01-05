from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse

from sentry.auth.helper import AuthHelper
from sentry.models import Organization
from sentry.web.frontend.base import BaseView


class AuthProviderLoginView(BaseView):
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

        provider = auth_provider.get_provider()(**auth_provider.config)

        helper = AuthHelper(request, provider)
        if not helper.pipeline_is_valid():
            helper.reset_pipeline()

        current_view = helper.get_current_view()
        return current_view.dispatch(request, provider)
