from __future__ import absolute_import, print_function

from django import forms
from django.contrib.auth import login
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext_lazy as _

from sentry import features
from sentry.auth.helper import AuthHelper
from sentry.models import AuthProvider, Organization
from sentry.utils.auth import get_login_redirect
from sentry.web.forms.accounts import AuthenticationForm
from sentry.web.frontend.base import BaseView


class SimplifiedAuthenticationForm(AuthenticationForm):
    username = forms.CharField(
        label=_('Account'), max_length=128, widget=forms.TextInput(
            attrs={'placeholder': _('username or email'),
        }),
    )
    password = forms.CharField(
        label=_('Password'), widget=forms.PasswordInput(
            attrs={'placeholder': _('password'),
        }),
    )


class AuthOrganizationLoginView(BaseView):
    auth_required = False

    def handle_basic_auth(self, request, organization):
        form = SimplifiedAuthenticationForm(
            request, request.POST or None,
            captcha=bool(request.session.get('needs_captcha')),
        )

        if form.is_valid():
            login(request, form.get_user())

            request.session.pop('needs_captcha', None)

            return self.redirect(get_login_redirect(request))

        elif request.POST and not request.session.get('needs_captcha'):
            request.session['needs_captcha'] = 1
            form = AuthenticationForm(request, request.POST or None, captcha=True)
            form.errors.pop('captcha', None)

        context = {
            'form': form,
            'CAN_REGISTER': features.has('auth:register') or request.session.get('can_register'),
            'organization': organization,
        }

        return self.respond('sentry/organization-login.html', context)

    def handle_sso(self, request, organization, auth_provider):
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
            'CAN_REGISTER': False,
            'organization': organization,
            'provider_key': provider.key,
            'provider_name': provider.name,
        }

        return self.respond('sentry/organization-login.html', context)

    def handle(self, request, organization_slug):
        try:
            organization = Organization.objects.get(
                slug=organization_slug
            )
        except Organization.DoesNotExist:
            return self.redirect(reverse('sentry-login'))

        request.session.set_test_cookie()

        try:
            auth_provider = AuthProvider.objects.get(
                organization=organization
            )
        except AuthProvider.DoesNotExist:
            auth_provider = None

        if not auth_provider:
            return self.handle_basic_auth(request, organization)
        return self.handle_sso(request, organization, auth_provider)
