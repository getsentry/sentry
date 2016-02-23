from __future__ import absolute_import, print_function


from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import transaction
from django.views.decorators.cache import never_cache

from sentry import features
from sentry.auth.helper import AuthHelper
from sentry.models import AuthProvider, Organization, OrganizationStatus
from sentry.utils import auth
from sentry.web.forms.accounts import AuthenticationForm, RegistrationForm
from sentry.web.frontend.base import BaseView


class AuthOrganizationLoginView(BaseView):
    auth_required = False

    def get_login_form(self, request):
        op = request.POST.get('op')
        return AuthenticationForm(
            request, request.POST if op == 'login' else None,
            captcha=bool(request.session.get('needs_captcha')),
        )

    def get_register_form(self, request):
        op = request.POST.get('op')
        return RegistrationForm(
            request.POST if op == 'register' else None,
            captcha=bool(request.session.get('needs_captcha')),
        )

    def handle_basic_auth(self, request, organization):
        can_register = features.has('auth:register') or request.session.get('can_register')

        op = request.POST.get('op')
        login_form = self.get_login_form(request)
        if can_register:
            register_form = self.get_register_form(request)
        else:
            register_form = None

        if can_register and register_form.is_valid():
            user = register_form.save()

            defaults = {
                'role': 'member',
            }

            organization.member_set.create(
                user=user,
                **defaults
            )

            # HACK: grab whatever the first backend is and assume it works
            user.backend = settings.AUTHENTICATION_BACKENDS[0]

            auth.login(request, user)

            # can_register should only allow a single registration
            request.session.pop('can_register', None)

            request.session.pop('needs_captcha', None)

            return self.redirect(auth.get_login_redirect(request))

        elif login_form.is_valid():
            auth.login(request, login_form.get_user())

            request.session.pop('needs_captcha', None)

            return self.redirect(auth.get_login_redirect(request))

        elif request.POST and not request.session.get('needs_captcha'):
            auth.log_auth_failure(request, request.POST.get('username'))
            request.session['needs_captcha'] = 1
            login_form = self.get_login_form(request)
            login_form.errors.pop('captcha', None)
            if can_register:
                register_form = self.get_register_form(request)
                register_form.errors.pop('captcha', None)

        request.session.set_test_cookie()

        context = {
            'op': op or 'login',
            'login_form': login_form,
            'register_form': register_form,
            'organization': organization,
            'CAN_REGISTER': can_register,
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

    @never_cache
    @transaction.atomic
    def handle(self, request, organization_slug):
        try:
            organization = Organization.objects.get(
                slug=organization_slug
            )
        except Organization.DoesNotExist:
            return self.redirect(reverse('sentry-login'))

        if organization.status != OrganizationStatus.VISIBLE:
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
