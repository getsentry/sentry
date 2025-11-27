from django.http import HttpRequest, HttpResponse
from django.views.generic import View

from sentry.auth.providers.dummy import DummyProvider
from sentry.models.organization import Organization
from sentry.web.frontend.base import internal_region_silo_view

from .mail import MailPreview


def get_context(request):
    org = Organization(name="My Company")
    provider = DummyProvider()

    return {"organization": org, "actor_email": request.user.email, "provider": provider}


@internal_region_silo_view
class DebugSsoLinkedEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        context = get_context(request)

        return MailPreview(
            text_template="sentry/emails/auth-link-identity.txt",
            html_template="sentry/emails/auth-link-identity.html",
            context=context,
        ).render(request)


@internal_region_silo_view
class DebugSsoUnlinkedEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        context = get_context(request)
        context["has_password"] = True

        return MailPreview(
            text_template="sentry/emails/auth-sso-disabled.txt",
            html_template="sentry/emails/auth-sso-disabled.html",
            context=context,
        ).render(request)


@internal_region_silo_view
class DebugSsoUnlinkedNoPasswordEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        context = get_context(request)
        context["has_password"] = False

        return MailPreview(
            text_template="sentry/emails/auth-sso-disabled.txt",
            html_template="sentry/emails/auth-sso-disabled.html",
            context=context,
        ).render(request)
