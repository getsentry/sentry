from __future__ import absolute_import

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.core.urlresolvers import reverse
from django.db import transaction
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.cache import never_cache

from sentry.auth.superuser import is_active_superuser
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.http import get_server_hostname
from sentry.models import AuthProvider, Organization, OrganizationStatus
from sentry.web.forms.accounts import AuthenticationForm, RegistrationForm
from sentry.web.frontend.base import BaseView
from sentry.utils import auth

ERR_NO_SSO = _(
    'The organization does not exist or does not have Single Sign-On enabled.')


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
            auth_provider = AuthProvider.objects.get(organization=organization)
        except AuthProvider.DoesNotExist:
            return None

        return auth_provider

    def get_login_form(self, request):
        op = request.POST.get('op')
        return AuthenticationForm(
            request,
            request.POST if op == 'login' else None,
        )

    def get_register_form(self, request, initial=None):
        op = request.POST.get('op')
        return RegistrationForm(
            request.POST if op == 'register' else None,
            initial=initial,
        )

    def can_register(self, request, *args, **kwargs):
        return bool(auth.has_user_registration() or request.session.get('can_register'))

    def get_next_uri(self, request, *args, **kwargs):
        next_uri_fallback = None
        if request.session.get('_next') is not None:
            next_uri_fallback = request.session.pop('_next')
        return request.GET.get(REDIRECT_FIELD_NAME, next_uri_fallback)

    def respond_login(self, request, context, *args, **kwargs):
        return self.respond('sentry/login.html', context)

    def handle_basic_auth(self, request, organization=None, *args, **kwargs):
        can_register = self.can_register(
            request, organization=organization, *args, **kwargs)

        op = request.POST.get('op')

        # Detect that we are on the register page by url /register/ and
        # then activate the register tab by default.
        if not op and '/register' in request.path_info and can_register:
            op = 'register'

        login_form = self.get_login_form(request)
        if can_register:
            register_form = self.get_register_form(
                request, initial={
                    'username': request.session.get('invite_email', '')}
            )
        else:
            register_form = None

        if can_register and register_form.is_valid():
            user = register_form.save()
            user.send_confirm_emails(is_new_user=True)

            # HACK: grab whatever the first backend is and assume it works
            user.backend = settings.AUTHENTICATION_BACKENDS[0]

            auth.login(
                request,
                user,
                organization_id=organization.id if organization else None,
            )

            # can_register should only allow a single registration
            request.session.pop('can_register', None)
            request.session.pop('invite_email', None)

            return self.redirect(auth.get_login_redirect(request))

        elif request.method == 'POST':
            from sentry.app import ratelimiter
            from sentry.utils.hashlib import md5_text

            login_attempt = op == 'login' and request.POST.get('username'
                                                               ) and request.POST.get('password')

            if login_attempt and ratelimiter.is_limited(
                u'auth:login:username:{}'.
                format(md5_text(request.POST['username'].lower()).hexdigest()),
                limit=10,
                window=60,  # 10 per minute should be enough for anyone
            ):
                login_form.errors['__all__'] = [
                    u'You have made too many login attempts. Please try again later.'
                ]
            elif login_form.is_valid():
                user = login_form.get_user()

                auth.login(
                    request,
                    user,
                    organization_id=organization.id if organization else None,
                )

                if not user.is_active:
                    return self.redirect(reverse('sentry-reactivate-account'))

                return self.redirect(auth.get_login_redirect(request))

        context = {
            'op': op or 'login',
            'server_hostname': get_server_hostname(),
            'login_form': login_form,
            'organization': organization,
            'register_form': register_form,
            'CAN_REGISTER': can_register,
        }
        return self.respond_login(request, context, organization=organization, *args, **kwargs)

    def handle_authenticated(self, request, *args, **kwargs):
        next_uri = self.get_next_uri(request, *args, **kwargs)
        if auth.is_valid_redirect(next_uri, host=request.get_host()):
            return self.redirect(next_uri)
        return self.redirect_to_org(request)

    @never_cache
    @transaction.atomic
    def handle(self, request, *args, **kwargs):
        return super(AuthLoginView, self).handle(request, *args, **kwargs)

    # XXX(dcramer): OAuth provider hooks this view
    def get(self, request, *args, **kwargs):
        next_uri = self.get_next_uri(request, *args, **kwargs)
        if request.user.is_authenticated():
            # if the user is a superuser, but not 'superuser authenticated'
            # we allow them to re-authenticate to gain superuser status
            if not request.user.is_superuser or is_active_superuser(request):
                return self.handle_authenticated(request, *args, **kwargs)

        request.session.set_test_cookie()

        # we always reset the state on GET so you dont end up at an odd location
        auth.initiate_login(request, next_uri)

        # Single org mode -- send them to the org-specific handler
        if settings.SENTRY_SINGLE_ORGANIZATION:
            org = Organization.get_default()
            next_uri = reverse('sentry-auth-organization', args=[org.slug])
            return HttpResponseRedirect(next_uri)

        session_expired = 'session_expired' in request.COOKIES
        if session_expired:
            messages.add_message(request, messages.WARNING,
                                 WARN_SESSION_EXPIRED)

        response = self.handle_basic_auth(request, *args, **kwargs)

        if session_expired:
            response.delete_cookie('session_expired')

        return response

    # XXX(dcramer): OAuth provider hooks this view
    def post(self, request, *args, **kwargs):
        op = request.POST.get('op')
        if op == 'sso' and request.POST.get('organization'):
            auth_provider = self.get_auth_provider(
                request.POST['organization'])
            if auth_provider:
                next_uri = reverse('sentry-auth-organization',
                                   args=[request.POST['organization']])
            else:
                next_uri = request.get_full_path()
                messages.add_message(request, messages.ERROR, ERR_NO_SSO)

            return HttpResponseRedirect(next_uri)

        return self.handle_basic_auth(request, *args, **kwargs)
