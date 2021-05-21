import threading

from django.core.signals import request_finished

from sentry.models import OrganizationMember

_cache = threading.local()


def request_cache(func):
    def wrapped(*args, **kwargs):
        if not hasattr(_cache, "items"):
            _cache.items = {}
        cache_key = (func, repr(args), repr(kwargs))
        rv = _cache.items.get(cache_key)
        if rv is None:
            rv = func(*args, **kwargs)
            _cache.items[cache_key] = rv
        return rv

    return wrapped


def clear_cache(**kwargs):
    _cache.items = {}


request_finished.connect(clear_cache)


@request_cache
def get_organization_member(user_id, organization_id):
    return OrganizationMember.objects.get(user_id=user_id, organization_id=organization_id)
