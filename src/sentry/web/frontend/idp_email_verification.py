from django.http.response import HttpResponse
from rest_framework.request import Request

from sentry.auth.idpmigration import SSO_VERIFICATION_KEY, verify_account
from sentry.utils.auth import get_login_url
from sentry.web.helpers import render_to_response


def idp_confirm_email(request: Request, key: str) -> HttpResponse:
    context = {"url": get_login_url()}
    if verify_account(key):
        request.session[SSO_VERIFICATION_KEY] = key
        return render_to_response("sentry/idp_email_verified.html", context, status=302)
    return render_to_response("sentry/idp_email_not_verified.html", context, status=302)
