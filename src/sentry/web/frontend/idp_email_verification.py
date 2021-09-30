from typing import Any, Mapping

from django.http.response import HttpResponse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.idpmigration import get_redis_key, verify_account
from sentry.utils.auth import get_login_url
from sentry.web.helpers import render_to_response


def _respond(
    template: str,
    context: Mapping[str, Any] = None,
    status: int = 302,
) -> HttpResponse:
    return render_to_response(template, context, status=status)


def idp_confirm_email(request: Request, key: str) -> Response:
    verification_key = get_redis_key(key)
    context = {"url": get_login_url()}
    if verify_account(key):
        request.session["confirm_account_verification_key"] = verification_key
        return _respond("sentry/idp_email_verified.html", context)
    return _respond("sentry/idp_email_not_verified.html", context)
