from __future__ import absolute_import

import time

from django.http import HttpResponseRedirect
from django.core.urlresolvers import reverse

from sentry.web.frontend.base import BaseView
from sentry.web.forms.accounts import TwoFactorForm
from sentry.web.helpers import render_to_response
from sentry.utils import auth, json
from sentry.models import Authenticator


class TwoFactorAuthView(BaseView):
    auth_required = False

    def perform_signin(self, request, user):
        auth.login(request, user, passed_2fa=True)
        return HttpResponseRedirect(auth.get_login_redirect(request))

    def fail_signin(self, request, user):
        # Ladies and gentlemen: he world's shittiest bruteforce
        # prevention.
        time.sleep(2.0)

    def negotiate_interface(self, request, interfaces):
        if len(interfaces) == 1:
            return interfaces[0]
        interface_id = request.GET.get('interface')
        if interface_id:
            for interface in interfaces:
                if interface.interface_id == interface_id:
                    return interface
        return interfaces[0]

    def get_other_interfaces(self, selected, all):
        rv = []
        for idx, interface in enumerate(all):
            if interface.interface_id == selected.interface_id:
                continue
            if idx == 0 or interface.requires_activation:
                rv.append(interface)
        return rv

    def handle(self, request):
        user = auth.get_pending_2fa_user(request)
        if user is None or request.user.is_authenticated():
            return HttpResponseRedirect(reverse('sentry'))

        interfaces = Authenticator.objects.all_interfaces_for_user(user)

        # If for whatever reason we ended up here but the user has no 2FA
        # enabled, we just continue successfully.
        if not interfaces:
            return self.perform_signin(request, user)

        challenge = activation = None
        interface = self.negotiate_interface(request, interfaces)
        if request.method == 'GET':
            activation = interface.activate(request)
            if activation is not None:
                challenge = activation.challenge
        elif 'challenge' in request.POST:
            challenge = json.loads(request.POST.get('challenge'))

        # If an OTP response was supplied, we try to make it pass.
        otp = request.POST.get('otp')
        if otp:
            if Authenticator.objects.validate_otp(user, otp):
                return self.perform_signin(request, user)
            self.fail_signin(request, user)

        # If a challenge and response exists, validate
        if challenge:
            response = request.POST.get('response')
            if response:
                response = json.loads(response)
                if interface.validate_response(request, challenge, response):
                    return self.perform_signin(request, user)
                self.fail_signin(request, user)

        form = TwoFactorForm()
        return render_to_response(['sentry/twofactor_%s.html' %
                                   interface.interface_id,
                                   'sentry/twofactor.html'], {
            'form': form,
            'interface': interface.interface_id,
            'other_interfaces': self.get_other_interfaces(interface, interfaces),
            'activation': activation,
        }, request, status=200)
