from __future__ import absolute_import, print_function

import logging

from django.contrib import messages
from django.contrib.auth import login
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry.auth.helper import AuthHelper
from sentry.models import AuthProvider, Organization, OrganizationMember
from sentry.web.forms.accounts import AuthenticationForm
from sentry.web.frontend.base import BaseView

ERR_LINK_INVALID = _('Either you are not a member of the given organization or it does not exist.')

auth_logger = logging.getLogger('sentry.auth')


class AuthLinkIdentityView(BaseView):
    auth_required = False

    def get_login_form(self, request):
        return AuthenticationForm(
            request, request.POST or None,
            captcha=bool(request.session.get('needs_captcha')),
        )

    def handle(self, request, organization_slug):
        try:
            organization = Organization.objects.get(
                slug=organization_slug
            )
        except Organization.DoesNotExist:
            auth_logger.debug('Organization not found: %s', organization_slug)
            messages.add_message(
                request, messages.ERROR,
                ERR_LINK_INVALID,
            )
            return self.redirect(reverse('sentry'))

        try:
            auth_provider = AuthProvider.objects.get(
                organization=organization
            )
        except AuthProvider.DoesNotExist:
            auth_logger.debug('Organization has no auth provider configured: %s',
                              organization.slug)
            messages.add_message(
                request, messages.ERROR,
                ERR_LINK_INVALID,
            )
            return self.redirect(reverse('sentry-organization-home',
                                         args=[organization.slug]))
        request.session.set_test_cookie()

        if request.user.is_authenticated():
            return self.handle_authed(request, organization, auth_provider)
        return self.handle_anon(request, organization, auth_provider)

    def handle_anon(self, request, organization, auth_provider):
        """
        Allow the user to authenticate and then link there account.

        This functions differently than the standard login flow as we *always*
        allow them to try a username/password, whereas the default flow would
        force the standard organization login.
        """
        form = self.get_login_form(request)

        if form.is_valid():
            login(request, form.get_user())

            request.session.pop('needs_captcha', None)

            return self.redirect(request.path)

        elif request.POST and not request.session.get('needs_captcha'):
            request.session['needs_captcha'] = 1
            form = self.get_login_form(request)
            form.errors.pop('captcha', None)

        context = {
            'form': form,
            'organization': organization,
        }
        return self.respond('sentry/auth-link-login.html', context)

    def handle_authed(self, request, organization, auth_provider):
        om = OrganizationMember.objects.filter(
            organization=organization,
            user=request.user,
        )
        if not om.exists():
            auth_logger.debug('User does is not a member of organization: %s',
                              organization.slug)
            messages.add_message(
                request, messages.ERROR,
                ERR_LINK_INVALID,
            )
            return self.redirect(reverse('sentry'))

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
