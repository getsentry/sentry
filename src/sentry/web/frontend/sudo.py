from __future__ import absolute_import

from sudo.views import SudoView as BaseSudoView

from sentry.models import Authenticator
from sentry.utils import json


class SudoView(BaseSudoView):
    template_name = 'sentry/account/sudo.html'

    def handle_sudo(self, request, redirect_to, context):
        interface = Authenticator.objects.get_interface(request.user, 'u2f')

        if interface.is_available and interface.is_enrolled:
            challenge = interface.activate(request).challenge
            if request.method == 'POST':
                if 'challenge' in request.POST:
                    challenge = json.loads(request.POST['challenge'])
                if 'response' in request.POST:
                    response = json.loads(request.POST['response'])
                    if interface.validate_response(request, challenge, response):
                        return True
            context['u2f_challenge'] = challenge

        return BaseSudoView.handle_sudo(self, request, redirect_to, context)
