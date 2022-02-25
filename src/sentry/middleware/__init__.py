from __future__ import annotations

import inspect
from typing import Callable, Union

from django.views import View
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


__all__ = ("get_path", "ViewFunc")
