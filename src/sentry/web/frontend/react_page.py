from fnmatch import fnmatch

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponseRedirect
from django.middleware.csrf import get_token as get_csrf_token
from django.urls import resolve
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.utils import customer_domain_path, generate_organization_url
from sentry.models import Project
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.signals import first_event_pending
from sentry.utils.http import is_using_customer_domain, query_string
from sentry.web.frontend.base import BaseView, OrganizationView
from sentry.web.helpers import render_to_response

# url names that should only be accessible from a non-customer domain hostname.
NON_CUSTOMER_DOMAIN_URL_NAMES = [
    "sentry-organization-create",
    "sentry-admin-overview",
    "sentry-account-*",
]


def resolve_redirect_url(request, org_slug, user_id=None):
    org_context = organization_service.get_organization_by_slug(
        slug=org_slug, only_visible=False, user_id=user_id
    )
    if org_context and features.has("organizations:customer-domains", org_context.organization):
        url_base = generate_organization_url(org_context.organization.slug)
        path = customer_domain_path(request.path)
        qs = query_string(request)
        return f"{url_base}{path}{qs}"
    return None


class ReactMixin:
    def meta_tags(self, request: Request, **kwargs):
        return {}

    def handle_react(self, request: Request, **kwargs) -> Response:
        context = {
            "CSRF_COOKIE_NAME": settings.CSRF_COOKIE_NAME,
            "meta_tags": [
                {"property": key, "content": value}
                for key, value in self.meta_tags(request, **kwargs).items()
            ],
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
            return HttpResponseRedirect(redirect_url)

        if request.subdomain is None and not url_is_non_customer_domain:
            matched_url = resolve(request.path)
            if "organization_slug" in matched_url.kwargs:
                org_slug = matched_url.kwargs["organization_slug"]
                redirect_url = resolve_redirect_url(
                    request=request, org_slug=org_slug, user_id=None
                )
                if redirect_url:
                    return HttpResponseRedirect(redirect_url)
            else:
                user = getattr(request, "user", None) or None
                if user is not None and not isinstance(user, AnonymousUser):
                    session = getattr(request, "session", None)
                    last_active_org = (session.get("activeorg", None) or None) if session else None
                    if last_active_org:
                        redirect_url = resolve_redirect_url(
                            request=request, org_slug=last_active_org, user_id=user.id
                        )
                        if redirect_url:
                            return HttpResponseRedirect(redirect_url)

        response = render_to_response("sentry/base-react.html", context=context, request=request)
        if "x-sentry-browser-profiling" in request.headers:
            response["Document-Policy"] = "js-profiling"
        return response


# TODO(dcramer): once we implement basic auth hooks in React we can make this
# generic
class ReactPageView(OrganizationView, ReactMixin):
    def handle_auth_required(self, request: Request, *args, **kwargs) -> Response:
        # If user is a superuser (but not active, because otherwise this method would never be called)
        # Then allow client to handle the route and respond to any API request errors
        if request.user.is_superuser:
            return self.handle_react(request)

        # For normal users, let parent class handle (e.g. redirect to login page)
        return super().handle_auth_required(request, *args, **kwargs)

    def handle(self, request: Request, organization, **kwargs) -> Response:
        if "project_id" in kwargs and request.GET.get("onboarding"):
            project = Project.objects.filter(
                organization=organization, slug=kwargs["project_id"]
            ).first()
            first_event_pending.send(project=project, user=request.user, sender=self)
        request.organization = organization
        return self.handle_react(request)


class GenericReactPageView(BaseView, ReactMixin):
    def handle(self, request: Request, **kwargs) -> Response:
        return self.handle_react(request, **kwargs)
