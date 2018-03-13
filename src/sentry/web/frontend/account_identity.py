from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from django.views.decorators.cache import never_cache

from sentry.models import IdentityProvider
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.web.frontend.base import OrganizationView, BaseView
from sentry.web.helpers import render_to_response


class AccountIdentityAssociateView(OrganizationView):
    @never_cache
    def handle(self, request, organization, provider_key):
        try:
            provider_model = IdentityProvider.objects.get(
                organization=organization,
                type=provider_key,
            )
        except IdentityProvider.DoesNotExist:
            return self.redirect(reverse('sentry-account-settings-identities'))

        pipeline = IdentityProviderPipeline(
            organization=organization,
            provider_key=provider_key,
            provider_model=provider_model,
            request=request,
        )

        if request.method != 'POST' and not pipeline.is_valid():
            context = {
                'provider': pipeline.provider,
                'organization': organization,
            }
            return render_to_response('sentry/auth-link-identity.html', context, request)

        pipeline.initialize()

        return pipeline.current_step()


class AccountIdentityLinkView(BaseView):
    @never_cache
    def handle(self, request):
        pipeline = IdentityProviderPipeline.get_for_request(request)

        if pipeline is None or not pipeline.is_valid():
            return self.redirect(reverse('sentry-account-settings-identity'))

        return pipeline.current_step()
