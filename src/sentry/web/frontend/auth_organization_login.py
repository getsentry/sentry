from __future__ import absolute_import, print_function


from django.conf import settings
from django.core.urlresolvers import reverse
from django.db import transaction
from django.views.decorators.cache import never_cache
from django.contrib import messages

from sentry import features
from sentry.auth.helper import AuthHelper
from sentry.constants import WARN_SESSION_EXPIRED
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
        )

    def get_register_form(self, request):
        op = request.POST.get('op')
        return RegistrationForm(
            request.POST if op == 'register' else None,
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
            user.send_confirm_emails(is_new_user=True)

            defaults = {
                'role': 'member',
            }

            organization.member_set.create(
                user=user,
                **defaults
            )

            # HACK: grab whatever the first backend is and assume it works
            user.backend = settings.AUTHENTICATION_BACKENDS[0]

            auth.login(request, user, organization_id=organization.id)

            # can_register should only allow a single registration
            request.session.pop('can_register', None)

            return self.redirect(auth.get_login_redirect(request))

        elif login_form.is_valid():
            auth.login(request, login_form.get_user(),
                       organization_id=organization.id)

            return self.redirect(auth.get_login_redirect(request))

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

        session_expired = 'session_expired' in request.COOKIES
        if session_expired:
            messages.add_message(request, messages.WARNING, WARN_SESSION_EXPIRED)

        if not auth_provider:
            response = self.handle_basic_auth(request, organization)
        else:
            response = self.handle_sso(request, organization, auth_provider)

        if session_expired:
            response.delete_cookie('session_expired')

        return response
