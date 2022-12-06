from __future__ import annotations

from typing import TYPE_CHECKING

from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.pipeline.views.base import PipelineView
from sentry.plugins.base.view import PluggableViewMixin
from sentry.web.frontend.base import BaseView

if TYPE_CHECKING:
    from sentry.models.authprovider import AuthProvider
    from sentry.models.organization import Organization


class AuthView(PipelineView):
    """
    A segment of Provider's auth pipeline.

    See ``BaseView`` for capabilities.
    """

    auth_required = False
    sudo_required = False

    def get_ident(self) -> str:
        cls = type(self)
        return f"{cls.__module__}.{cls.__name__}"


class ConfigureView(BaseView, PluggableViewMixin):
    def dispatch(
        self, request: Request, organization: Organization, auth_provider: AuthProvider
    ) -> HttpResponseBase:
        raise NotImplementedError


__all__ = ["AuthView", "ConfigureView"]
