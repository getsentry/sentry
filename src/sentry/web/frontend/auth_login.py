from __future__ import absolute_import, print_function

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.utils.translation import ugettext_lazy as _

from sentry import features
from sentry.models import AuthProvider, Organization
from sentry.web.forms.accounts import AuthenticationForm
from sentry.web.frontend.base import BaseView
from sentry.utils.auth import get_login_redirect

ERR_NO_SSO = _('The organization does not exist or does not have Single Sign-On enabled.')


class AuthLoginView(BaseView):
    auth_required = False

    def get_auth_provider(self, organization_slug):
        try:
            organization = Organization.objects.get(
                slug=organization_slug
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

    def handle_basic_auth(self, request):
        if request.user.is_authenticated():
            return self.redirect(get_login_redirect(request))

        form = AuthenticationForm(
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

        request.session.set_test_cookie()

        context = {
            'form': form,
            'CAN_REGISTER': features.has('auth:register') or request.session.get('can_register'),
        }
        return self.respond('sentry/login.html', context)

    def handle(self, request):
        if settings.SENTRY_SINGLE_ORGANIZATION:
            org = Organization.objects.all()[0]
            next_uri = reverse('sentry-auth-organization',
                               args=[org.slug])
            return HttpResponseRedirect(next_uri)

        if request.POST.get('op') == 'sso' and request.POST.get('organization'):
            auth_provider = self.get_auth_provider(request.POST['organization'])
            if auth_provider:
                next_uri = reverse('sentry-auth-organization',
                                   args=[request.POST['organization']])
            else:
                next_uri = request.path
                messages.add_message(request, messages.ERROR, ERR_NO_SSO)

            return HttpResponseRedirect(next_uri)

        return self.handle_basic_auth(request)
