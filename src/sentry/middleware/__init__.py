from __future__ import annotations

import inspect
from collections.abc import Callable
from typing import Union

from django.views import View
from rest_framework.request import Request
from rest_framework.response import Response

# TODO(mgaeta): It's not currently possible to type a Callable's args with kwargs.
ViewFunc = Union[Callable[..., Response], View]


def get_path(view_func: ViewFunc) -> str | None:
    view = view_func if inspect.isfunction(view_func) else view_func.__class__

    try:
        path = f"{view.__module__}.{view.__name__}"
    except AttributeError:
        return None

    return path


def is_frontend_request(request: Request) -> bool:
    """
    Used to determine if a request came from the UI or not. UI requests will have cookies and no
    authentication tokens, while requests coming from user scripts will tend to be the opposite.

    Users could make backend requests directly with cookies which would be counted here. The
    belief is that that's a fraction of the total requests. Either way, this function should not be
    used expecting it to be 100% accurate. We are using it only for statistics.
    """
    return bool(request.COOKIES) and request.auth is None


__all__ = ("get_path", "is_frontend_request", "ViewFunc")
