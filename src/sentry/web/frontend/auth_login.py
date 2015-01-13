from __future__ import absolute_import, print_function

from django.contrib.auth import login
from django.conf import settings

from sentry.web.forms.accounts import AuthenticationForm
from sentry.web.frontend.base import BaseView
from sentry.utils.auth import get_auth_providers, get_login_redirect


class AuthLoginView(BaseView):
    auth_required = False

    def handle(self, request):
        if request.user.is_authenticated():
            return self.redirect(get_login_redirect(request))

        form = AuthenticationForm(request, request.POST or None,
                                  captcha=bool(request.session.get('needs_captcha')))
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
            'next': request.session.get('_next'),
            'CAN_REGISTER': settings.SENTRY_ALLOW_REGISTRATION or request.session.get('can_register'),
            'AUTH_PROVIDERS': get_auth_providers(),
            'SOCIAL_AUTH_CREATE_USERS': settings.SOCIAL_AUTH_CREATE_USERS,
        }
        return self.respond('sentry/login.html', context)
