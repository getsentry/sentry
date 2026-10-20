from collections.abc import Callable

from django.http import HttpRequest, HttpResponseRedirect
from django.http.response import HttpResponseBase
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache

from sentry import features
from sentry.organizations.services.organization import organization_service
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.auth import construct_link_with_query
from sentry.utils.http import absolute_uri
from sentry.utils.sdk import capture_exception
from sentry.web.frontend.base import BaseView, control_silo_view
from sentry.web.frontend.react_page import ReactMixin


class AdditionalContext:
    def __init__(self):
        self._callbacks = set()

    def add_callback(self, callback: Callable[[HttpRequest], dict]) -> None:
        """
        Callback should take a request object and return a dict of key-value pairs
        to add to the context.
        """
        self._callbacks.add(callback)

    def run_callbacks(self, request: HttpRequest) -> dict:
        context = {}
        for cb in self._callbacks:
            try:
                result = cb(request)
                context.update(result)
            except Exception:
                capture_exception()
        return context


additional_context = AdditionalContext()


@control_silo_view
class AuthPageView(BaseView, ReactMixin):
    auth_required = False
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={"GET": {RateLimitCategory.IP: RateLimit(limit=20, window=1)}}
    )

    @method_decorator(never_cache)
    def handle(self, request: HttpRequest, *args, **kwargs) -> HttpResponseBase:
        return super().handle(request, *args, **kwargs)

    def get(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        customer_domain_redirect = self.get_customer_domain_login_redirect(request)
        if customer_domain_redirect is not None:
            return customer_domain_redirect

        return self.handle_react(request)

    def get_customer_domain_login_redirect(
        self, request: HttpRequest
    ) -> HttpResponseRedirect | None:
        if (
            not features.has("system:multi-region")
            or request.user.is_authenticated
            or not request.subdomain
            or organization_service.check_organization_by_slug(
                slug=request.subdomain, only_visible=True
            )
            is None
        ):
            return None

        if request.path_info == reverse("sentry-register"):
            path = reverse("sentry-register")
        else:
            path = reverse("sentry-auth-organization", args=[request.subdomain])

        path = construct_link_with_query(
            path=path,
            query_params=request.GET,
        )
        return HttpResponseRedirect(absolute_uri(path))
