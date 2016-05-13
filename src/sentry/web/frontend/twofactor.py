from __future__ import absolute_import

from django.http import HttpResponseRedirect
from django.core.urlresolvers import reverse

from sentry.web.frontend.base import BaseView
from sentry.web.forms.accounts import TwoFactorForm
from sentry.web.helpers import render_to_response
from sentry.utils import auth
from sentry.models import Authenticator


class TwoFactorAuthView(BaseView):
    auth_required = False

    def perform_signin(self, request, user):
        auth.login(request, user, passed_2fa=True)
        return HttpResponseRedirect(auth.get_login_redirect(request))

    def handle(self, request):
        user = auth.get_pending_2fa_user(request)
        if user is None or request.user.is_authenticated():
            return HttpResponseRedirect(reverse('sentry'))

        # If for whatever reason we ended up here but the user has no 2FA
        # enabled, we just continue successfully.
        if not Authenticator.objects.user_has_2fa(user):
            return self.perform_signin(request, user)

        otp = request.POST.get('otp')
        if otp:
            if Authenticator.objects.validate_otp(user, otp):
                return self.perform_signin(request, user)

        form = TwoFactorForm()
        return render_to_response('sentry/twofactor.html', {
            'form': form,
        }, request, status=200)
