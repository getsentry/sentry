from __future__ import annotations

from sentry.web.frontend.base import BaseView


class AuthView(BaseView):
    """
    A segment of Provider's auth pipeline.

    See ``BaseView`` for capabilities.
    """

    auth_required = False
    sudo_required = False

    def get_ident(self) -> str:
        cls = type(self)
        return f"{cls.__module__}.{cls.__name__}"


__all__ = ("AuthView",)
