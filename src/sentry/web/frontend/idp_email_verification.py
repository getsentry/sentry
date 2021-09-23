from django.http.response import HttpResponseNotFound, HttpResponseRedirect
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.idpmigration import verify_new_identity
from sentry.utils.auth import get_login_url
from sentry.web.frontend.base import BaseView


class IDPEmailVerificationView(BaseView):
    def confirm_email(request: Request, key: str) -> Response:
        verification_key = verify_new_identity(key)
        if verification_key:
            request.session["verification_key"] = verification_key
            login = get_login_url()
            redirect = HttpResponseRedirect(login)
            return redirect
        # TODO add view that shows key not found
        return HttpResponseNotFound()
