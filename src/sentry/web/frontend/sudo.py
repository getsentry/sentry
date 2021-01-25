from sudo.views import SudoView as BaseSudoView

from sentry.models import Authenticator
from sentry.utils import json


class SudoView(BaseSudoView):
    template_name = "sentry/account/sudo.html"

    def handle_sudo(self, request, redirect_to, context):
        if BaseSudoView.handle_sudo(self, request, redirect_to, context):
            return True

        try:
            interface = Authenticator.objects.get_interface(request.user, "u2f")
            if not interface.is_enrolled():
                raise LookupError()
        except LookupError:
            return False

        challenge = interface.activate(request).challenge
        if request.method == "POST":
            if "challenge" in request.POST and "response" in request.POST:
                try:
                    challenge = json.loads(request.POST["challenge"])
                    response = json.loads(request.POST["response"])
                except ValueError:
                    pass
                else:
                    if interface.validate_response(request, challenge, response):
                        return True
        context["u2f_challenge"] = challenge
        return False
