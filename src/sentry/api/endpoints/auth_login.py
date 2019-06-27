from __future__ import absolute_import

from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.core.urlresolvers import reverse
from rest_framework.response import Response

from sentry import newsletter
from sentry.app import ratelimiter
from sentry.auth.superuser import is_active_superuser
from sentry.constants import WARN_SESSION_EXPIRED
from sentry.http import get_server_hostname
from sentry.models import Organization
from sentry.utils import auth, metrics
from sentry.utils.hashlib import md5_text
from sentry.api.base import Endpoint
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.web.forms.accounts import AuthenticationForm
from sentry.web.frontend.auth_login import additional_context
from sentry.web.frontend.base import OrganizationMixin


class AuthLoginEndpoint(Endpoint, OrganizationMixin):
    # Disable authentication and permission requirements.
    authentication_classes = []
    permission_classes = []

    def get(self, request, *args, **kwargs):
        """
        Get context required to show a login page.
        Registration is handled elsewhere.
        """
        next_uri = self.get_next_uri(request)
        if request.user.is_authenticated():
            # if the user is a superuser, but not 'superuser authenticated'
            # we allow them to re-authenticate to gain superuser status
            if not request.user.is_superuser or is_active_superuser(request):
                return self.handle_authenticated(request)

        # we always reset the state on GET so you dont end up at an odd location
        auth.initiate_login(request, next_uri)

        # Single org mode -- send them to the org-specific handler
        if settings.SENTRY_SINGLE_ORGANIZATION:
            org = Organization.get_default()
            payload = {
                'nextUri': reverse('sentry-auth-organization', args=[org.slug]),
            }
            return Response(payload)

        session_expired = 'session_expired' in request.COOKIES
        payload = self.prepare_login_context(request, *args, **kwargs)
        response = Response(payload)

        if session_expired:
            response.delete_cookie('session_expired')

        return response

    def handle_authenticated(self, request):
        next_uri = self.get_next_uri(request)

        if not auth.is_valid_redirect(next_uri, host=request.get_host()):
            next_uri = self.org_redirect_url(request)

        return Response({
            'nextUri': next_uri,
        })

    def org_redirect_url(self, request):
        from sentry import features

        # TODO(dcramer): deal with case when the user cannot create orgs
        organization = self.get_active_organization(request)

        if organization:
            return organization.get_url()
        if not features.has('organizations:create'):
            return '/auth/login'
        return '/organizations/new/'

    def get_next_uri(self, request):
        next_uri_fallback = None
        if request.session.get('_next') is not None:
            next_uri_fallback = request.session.pop('_next')
        return request.GET.get(REDIRECT_FIELD_NAME, next_uri_fallback)

    def can_register(self, request, *args, **kwargs):
        return bool(auth.has_user_registration() or request.session.get('can_register'))

    def prepare_login_context(self, request, *args, **kwargs):
        session_expired = 'session_expired' in request.COOKIES
        context = {
            'serverHostname': get_server_hostname(),
            'canRegister': self.can_register(request),
            'hasNewsletter': newsletter.is_enabled(),
        }
        if session_expired:
            context['warning'] = WARN_SESSION_EXPIRED
        context.update(additional_context.run_callbacks(request))

        return context

    def post(self, request, organization=None, *args, **kwargs):
        """
        Process a login request via username/password.
        SSO login is handled elsewhere.
        """
        login_form = self.get_login_form(request)

        errors = {}
        if ratelimiter.is_limited(
            u'auth:login:username:{}'.
            format(md5_text(request.DATA.get('username').lower()).hexdigest()),
            limit=10,
            window=60,  # 10 per minute should be enough for anyone
        ):
            errors['__all__'] = [
                u'You have made too many login attempts. Please try again later.'
            ]
            metrics.incr(
                'login.attempt',
                instance='rate_limited',
                skip_internal=True,
                sample_rate=1.0
            )
        elif login_form.is_valid():
            user = login_form.get_user()

            auth.login(
                request,
                user,
                organization_id=organization.id if organization else None,
            )
            metrics.incr(
                'login.attempt',
                instance='success',
                skip_internal=True,
                sample_rate=1.0
            )

            if not user.is_active:
                return self.redirect(reverse('sentry-reactivate-account'))

            context = {
                'nextUri': auth.get_login_redirect(request, self.org_redirect_url(request)),
                'user': serialize(user, user, DetailedUserSerializer()),
            }

            return Response(context)
        else:
            metrics.incr(
                'login.attempt',
                instance='failure',
                skip_internal=True,
                sample_rate=1.0
            )
            errors = login_form.errors
        if errors:
            return Response({'detail': 'Login attempt failed', 'errors': errors}, status=400)
        return Response({'detail': 'Login attempt failed'}, status=400)

    def get_login_form(self, request):
        return AuthenticationForm(request, request.DATA)
