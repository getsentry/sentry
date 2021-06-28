from django.urls import reverse
from django.views.decorators.cache import never_cache as django_never_cache

from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign
from sentry.utils.types import Any
from sentry.web.decorators import EndpointFunc


def never_cache(view_func: EndpointFunc) -> EndpointFunc:
    """TODO(mgaeta): Remove cast once Django has a typed version."""
    result: EndpointFunc = django_never_cache(view_func)
    return result


def build_linking_url(endpoint: str, **kwargs: Any) -> str:
    """TODO(mgaeta): Remove cast once sentry/utils/http.py is typed."""
    url: str = absolute_uri(reverse(endpoint, kwargs={"signed_params": sign(**kwargs)}))
    return url
