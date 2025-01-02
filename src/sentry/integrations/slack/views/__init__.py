from typing import Any

from django.http import HttpRequest, HttpResponse
from django.urls import reverse
from rest_framework.request import Request

from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign
from sentry.web.helpers import render_to_response

SALT = "sentry-slack-integration"


def build_linking_url(endpoint: str, **kwargs: Any) -> str:
    """TODO(mgaeta): Remove cast once sentry/utils/http.py is typed."""
    url: str = absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(salt=SALT, **kwargs)}))
    return url


def render_error_page(request: Request | HttpRequest, status: int, body_text: str) -> HttpResponse:
    return render_to_response(
        "sentry/integrations/generic-error.html",
        request=request,
        status=status,
        context={"body_text": body_text},
    )
