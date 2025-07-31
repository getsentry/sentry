from __future__ import annotations

from sentry.web.frontend.base import BaseView


class AuthView(BaseView):
    """
    A segment of Provider's auth pipeline.

    See ``BaseView`` for capabilities.
    """

    auth_required = False
    sudo_required = False


__all__ = ("AuthView",)
