from typing import NoReturn

from django.http import HttpRequest


def placeholder_get_response(request: HttpRequest) -> NoReturn:
    """usage: `cls(get_response=placeholder_get_response)`

    generally this is filled in by the request cycle but occasionally we use
    middleware outside of the request cycle.
    """
    raise AssertionError("unreachable")
