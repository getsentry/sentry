from __future__ import absolute_import

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.core.urlresolvers import reverse
from django.db import transaction
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.cache import never_cache

from sentry import features
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.http import get_server_hostname
from sentry.models import AuthProvider, Organization, OrganizationStatus
from sentry.web.forms.accounts import AuthenticationForm, RegistrationForm
from sentry.web.frontend.base import BaseView
from sentry.utils import auth

ERR_NO_SSO = _('The organization does not exist or does not have Single Sign-On enabled.')


class AuthLoginView(BaseView):
    auth_required = False

    def get_auth_provider(self, organization_slug):
        try:
            organization = Organization.objects.get(
                slug=organization_slug,
                status=OrganizationStatus.VISIBLE,
            )
        except Organization.DoesNotExist:
            return None

        try:
            auth_provider = AuthProvider.objects.get(
                organization=organization
            )
        except AuthProvider.DoesNotExist:
            return None

        return auth_provider

    def get_login_form(self, request):
        op = request.POST.get('op')
        return AuthenticationForm(
            request, request.POST if op == 'login' else None,
        )

    def get_register_form(self, request, initial=None):
        op = request.POST.get('op')
        return RegistrationForm(
            request.POST if op == 'register' else None,
            initial=initial,
        )

    def handle_basic_auth(self, request):
        can_register = features.has('auth:register') or request.session.get('can_register')

        op = request.POST.get('op')

        # Detect that we are on the register page by url /register/ and
        # then activate the register tab by default.
        if not op and '/register' in request.path_info and can_register:
            op = 'register'

        login_form = self.get_login_form(request)
        if can_register:
            register_form = self.get_register_form(request, initial={
                'username': request.session.get('invite_email', '')
            })
        else:
            register_form = None

        if can_register and register_form.is_valid():
            user = register_form.save()
            user.send_confirm_emails(is_new_user=True)

            # HACK: grab whatever the first backend is and assume it works
            user.backend = settings.AUTHENTICATION_BACKENDS[0]

            auth.login(request, user)

            # can_register should only allow a single registration
            request.session.pop('can_register', None)
            request.session.pop('invite_email', None)

            return self.redirect(auth.get_login_redirect(request))

        elif login_form.is_valid():
            user = login_form.get_user()

            auth.login(request, user)

            if not user.is_active:
                return self.redirect(reverse('sentry-reactivate-account'))

            return self.redirect(auth.get_login_redirect(request))

        context = {
            'op': op or 'login',
            'server_hostname': get_server_hostname(),
            'login_form': login_form,
            'register_form': register_form,
            'CAN_REGISTER': can_register,
        }
        return self.respond('sentry/login.html', context)

    def handle_sso(self, request):
        org = request.POST.get('organization')
        if not org:
            return HttpResponseRedirect(request.path)

        auth_provider = self.get_auth_provider(request.POST['organization'])
        if auth_provider:
            next_uri = reverse('sentry-auth-organization',
                               args=[request.POST['organization']])
        else:
            next_uri = request.path
            messages.add_message(request, messages.ERROR, ERR_NO_SSO)

        return HttpResponseRedirect(next_uri)

    @never_cache
    @transaction.atomic
    def handle(self, request):
        next_uri = request.GET.get(REDIRECT_FIELD_NAME, None)
        if request.user.is_authenticated():
            if auth.is_valid_redirect(next_uri, host=request.get_host()):
                return self.redirect(next_uri)
            return self.redirect_to_org(request)

        request.session.set_test_cookie()

        if next_uri:
            auth.initiate_login(request, next_uri)

        # Single org mode -- send them to the org-specific handler
        if settings.SENTRY_SINGLE_ORGANIZATION:
            org = Organization.get_default()
            next_uri = reverse('sentry-auth-organization',
                               args=[org.slug])
            return HttpResponseRedirect(next_uri)

        op = request.POST.get('op')
        if op == 'sso' and request.POST.get('organization'):
            auth_provider = self.get_auth_provider(request.POST['organization'])
            if auth_provider:
                next_uri = reverse('sentry-auth-organization',
                                   args=[request.POST['organization']])
            else:
                next_uri = request.path
                messages.add_message(request, messages.ERROR, ERR_NO_SSO)

            return HttpResponseRedirect(next_uri)

        session_expired = 'session_expired' in request.COOKIES
        if session_expired:
            messages.add_message(request, messages.WARNING, WARN_SESSION_EXPIRED)

        response = self.handle_basic_auth(request)

        if session_expired:
            response.delete_cookie('session_expired')

        return response
