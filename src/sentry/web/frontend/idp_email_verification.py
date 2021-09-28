from django.http.response import HttpResponseNotFound, HttpResponseRedirect
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.idpmigration import get_redis_key, verify_account
from sentry.utils.auth import get_login_url


class IDPEmailVerificationView:
    def confirm_email(request: Request, key: str) -> Response:
        verification_key = get_redis_key(key)
        if verify_account(key):
            request.session["confirm_account_verification_key"] = verification_key
            # TODO Change so it redirects to a confirmation page that needs to be made: Simple page with a confirmation msg and redirect to login
            login = get_login_url()
            redirect = HttpResponseRedirect(login)
            return redirect
        # TODO add view that shows key not found
        return HttpResponseNotFound()
