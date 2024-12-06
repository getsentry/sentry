from __future__ import annotations

import logging
from fnmatch import fnmatch

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http import Http404, HttpRequest, HttpResponse, HttpResponseRedirect
from django.middleware.csrf import get_token as get_csrf_token
from django.urls import resolve
from rest_framework.request import Request

from sentry import features, options
from sentry.api.utils import generate_region_url
from sentry.organizations.absolute_url import customer_domain_path, generate_organization_url
from sentry.organizations.services.organization import organization_service
from sentry.types.region import (
    find_all_multitenant_region_names,
    get_region_by_name,
    subdomain_is_region,
)
from sentry.users.services.user.model import RpcUser
from sentry.utils.http import is_using_customer_domain, query_string
from sentry.web.client_config import get_client_config
from sentry.web.frontend.base import BaseView, ControlSiloOrganizationView
from sentry.web.helpers import render_to_response

logger = logging.getLogger(__name__)


# url names that should only be accessible from a non-customer domain hostname.
NON_CUSTOMER_DOMAIN_URL_NAMES = [
    "sentry-organization-create",
    "sentry-admin-overview",
    "sentry-account-*",
]


def resolve_redirect_url(request: HttpRequest | Request, org_slug: str, user_id=None):
    org_context = organization_service.get_organization_by_slug(
        slug=org_slug,
        only_visible=False,
        user_id=user_id,
        include_projects=False,
        include_teams=False,
    )
    if org_context and features.has("system:multi-region"):
        url_base = generate_organization_url(org_context.organization.slug)
        path = customer_domain_path(request.path)
        qs = query_string(request)
        return f"{url_base}{path}{qs}"
    return None


def resolve_activeorg_redirect_url(request: HttpRequest | Request) -> str | None:
    user: AnonymousUser | RpcUser | None = getattr(request, "user", None)
    if not user or isinstance(user, AnonymousUser):
        return None
    session = request.session
    if not session:
        return None
    last_active_org = session.get("activeorg", None)
    if not last_active_org:
        return None
    return resolve_redirect_url(request=request, org_slug=last_active_org, user_id=user.id)


class ReactMixin:
    def meta_tags(self, request: Request, **kwargs):
        return {}

    def preconnect(self) -> list[str]:
        preconnects = []
        if settings.STATIC_ORIGIN is not None:
            preconnects.append(settings.STATIC_ORIGIN)
        return preconnects

    def dns_prefetch(self) -> list[str]:
        regions = find_all_multitenant_region_names()
        domains = []
        if len(regions) < 2:
            return domains
        for region_name in regions:
            region = get_region_by_name(region_name)
            domains.append(generate_region_url(region.name))
        return domains

    def handle_react(self, request: Request, **kwargs) -> HttpResponse:
        org_context = getattr(self, "active_organization", None)
        context = {
            "CSRF_COOKIE_NAME": settings.CSRF_COOKIE_NAME,
            "meta_tags": [
                {"property": key, "content": value}
                for key, value in self.meta_tags(request, **kwargs).items()
            ],
            "dns_prefetch": self.dns_prefetch(),
            "preconnect": self.preconnect(),
            # Rendering the layout requires serializing the active organization.
            # Since we already have it here from the OrganizationMixin, we can
            # save some work and render it faster.
            "org_context": org_context,
            "react_config": get_client_config(request, org_context),
        }

        # Force a new CSRF token to be generated and set in user's
        # Cookie. Alternatively, we could use context_processor +
        # template tag, but in this case, we don't need a form on the
        # page. So there's no point in rendering a random `<input>` field.
        get_csrf_token(request)

        url_name = request.resolver_match.url_name
        url_is_non_customer_domain = (
            any(fnmatch(url_name, p) for p in NON_CUSTOMER_DOMAIN_URL_NAMES) if url_name else False
        )

        # If a customer domain is being used, and if a non-customer domain url_name is
        # encountered, we redirect the user to sentryUrl.
        if is_using_customer_domain(request) and url_is_non_customer_domain:
            redirect_url = options.get("system.url-prefix")
            qs = query_string(request)
            redirect_url = f"{redirect_url}{request.path}{qs}"
            logger.info(
                "react_page.redirect.to_sentry_url",
                extra={"path": request.path, "location": redirect_url},
            )
            return HttpResponseRedirect(redirect_url)

        # We don't allow HTML pages to be served from region domains.
        if request.subdomain and subdomain_is_region(request):
            redirect_url = resolve_activeorg_redirect_url(request)
            if redirect_url:
                logger.info(
                    "react_page.redirect.regiondomain",
                    extra={"path": request.path, "location": redirect_url},
                )
                return HttpResponseRedirect(redirect_url)
            else:
                raise Http404()

        # If a request doesn't have a subdomain, but is expected to be
        # on a customer domain, and the route parameters include an organization slug
        # redirect to that organization domain.
        if request.subdomain is None and not url_is_non_customer_domain:
            matched_url = resolve(request.path)
            if "organization_slug" in matched_url.kwargs:
                org_slug = matched_url.kwargs["organization_slug"]
                redirect_url = resolve_redirect_url(
                    request=request, org_slug=org_slug, user_id=None
                )
                if redirect_url:
                    logger.info(
                        "react_page.redirect.orgdomain",
                        extra={"path": request.path, "location": redirect_url},
                    )
                    return HttpResponseRedirect(redirect_url)
            else:
                redirect_url = resolve_activeorg_redirect_url(request)
                if redirect_url:
                    logger.info(
                        "react_page.redirect.activeorg",
                        extra={"path": request.path, "location": redirect_url},
                    )
                    return HttpResponseRedirect(redirect_url)

        response = render_to_response("sentry/base-react.html", context=context, request=request)

        try:
            if "x-sentry-browser-profiling" in request.headers or (
                getattr(request, "organization", None) is not None
                and features.has("organizations:profiling-browser", request.organization)
            ):
                response["Document-Policy"] = "js-profiling"
        except Exception as error:
            sentry_sdk.capture_exception(error)

        return response


# TODO(dcramer): once we implement basic auth hooks in React we can make this
# generic
class ReactPageView(ControlSiloOrganizationView, ReactMixin):
    def handle_auth_required(self, request: Request, *args, **kwargs) -> HttpResponse:
        # If user is a superuser (but not active, because otherwise this method would never be called)
        # Then allow client to handle the route and respond to any API request errors
        if request.user.is_superuser:
            return self.handle_react(request)

        # For normal users, let parent class handle (e.g. redirect to login page)
        return super().handle_auth_required(request, *args, **kwargs)

    def handle(self, request: HttpRequest, organization, **kwargs) -> HttpResponse:
        request.organization = organization
        return self.handle_react(request)


class GenericReactPageView(BaseView, ReactMixin):
    def handle(self, request: HttpRequest, **kwargs) -> HttpResponse:
        return self.handle_react(request, **kwargs)
