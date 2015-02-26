from __future__ import absolute_import, print_function

from django.contrib import messages
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry.auth.helper import AuthHelper
from sentry.models import AuthProvider, Organization, OrganizationMember
from sentry.web.frontend.base import BaseView

ERR_INVITE_INVALID = _('The invite link you followed is not valid.')


class AuthLinkIdentityView(BaseView):
    # TODO(dcramer): ideally we could show a login form here if they were auth'd
    # as an invalid account
    def handle(self, request, organization_slug, token):
        try:
            organization = Organization.objects.get(
                slug=organization_slug
            )
        except Organization.DoesNotExist:
            messages.add_message(
                request, messages.ERROR,
                ERR_INVITE_INVALID,
            )
            return self.redirect(reverse('sentry'))

        try:
            om = OrganizationMember.objects.get(
                organization=organization,
                user=request.user,
            )
        except OrganizationMember.DoesNotExist():
            messages.add_message(
                request, messages.ERROR,
                ERR_INVITE_INVALID,
            )
            return self.redirect(reverse('sentry'))

        if om.token != token:
            messages.add_message(
                request, messages.ERROR,
                ERR_INVITE_INVALID,
            )
            return self.redirect(reverse('sentry-organization-home',
                                         args=[organization.slug]))

        try:
            auth_provider = AuthProvider.objects.get(
                organization=organization
            )
        except AuthProvider.DoesNotExist:
            messages.add_message(
                request, messages.ERROR,
                ERR_INVITE_INVALID,
            )
            return self.redirect(reverse('sentry-organization-home',
                                         args=[organization.slug]))

        if request.method == 'POST':
            helper = AuthHelper(
                request=request,
                organization=organization,
                auth_provider=auth_provider,
                flow=AuthHelper.FLOW_LINK_IDENTITY,
            )
            helper.init_pipeline()
            return helper.next_step()

        provider = auth_provider.get_provider()

        context = {
            'organization': organization,
            'provider_key': provider.key,
            'provider_name': provider.name,
        }

        return self.respond('sentry/auth-link-identity.html', context)
