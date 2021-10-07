from django.http.response import HttpResponse
from rest_framework.request import Request

from sentry.auth.idpmigration import SSO_VERIFICATION_KEY, get_org, verify_account
from sentry.web.frontend.base import BaseView
from sentry.web.helpers import render_to_response


class AccountConfirmationView(BaseView):
    # the user using this endpoint is currently locked out of their account so auth isn't required.
    auth_required = False

    def handle(self, request: Request, key: str) -> HttpResponse:
        if verify_account(key):
            context = {"org": get_org(key)}
            request.session[SSO_VERIFICATION_KEY] = key
            return render_to_response(
                "sentry/idp_account_verified.html", context=context, request=request
            )
        return render_to_response("sentry/idp_account_not_verified.html", request=request)
