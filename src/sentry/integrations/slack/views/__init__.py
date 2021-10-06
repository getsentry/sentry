from django.http import HttpResponse
from django.urls import reverse
from django.views.decorators.cache import never_cache as django_never_cache
from rest_framework.request import Request

from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign
from sentry.utils.types import Any
from sentry.web.decorators import EndpointFunc
from sentry.web.helpers import render_to_response


def never_cache(view_func: EndpointFunc) -> EndpointFunc:
    """TODO(mgaeta): Remove cast once Django has a typed version."""
    result: EndpointFunc = django_never_cache(view_func)
    return result


def build_linking_url(endpoint: str, **kwargs: Any) -> str:
    """TODO(mgaeta): Remove cast once sentry/utils/http.py is typed."""
    url: str = absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(**kwargs)}))
    return url


def render_error_page(request: Request, body_text: str) -> HttpResponse:
    return render_to_response(
        "sentry/integrations/slack/link-team-error.html",
        request=request,
        context={"body_text": body_text},
    )
