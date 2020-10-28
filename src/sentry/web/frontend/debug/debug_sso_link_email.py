from __future__ import absolute_import, print_function

from django.views.generic import View

from sentry.auth.providers.dummy import DummyProvider
from sentry.models import Organization

from .mail import MailPreview


def get_context(request):
    org = Organization(name="My Company")
    provider = DummyProvider("dummy")

    return {"organization": org, "actor": request.user, "provider": provider}


class DebugSsoLinkedEmailView(View):
    def get(self, request):
        context = get_context(request)

        return MailPreview(
            text_template="sentry/emails/auth-link-identity.txt",
            html_template="sentry/emails/auth-link-identity.html",
            context=context,
        ).render(request)


class DebugSsoUnlinkedEmailView(View):
    def get(self, request):
        context = get_context(request)
        context["has_password"] = True

        return MailPreview(
            text_template="sentry/emails/auth-sso-disabled.txt",
            html_template="sentry/emails/auth-sso-disabled.html",
            context=context,
        ).render(request)


class DebugSsoUnlinkedNoPasswordEmailView(View):
    def get(self, request):
        context = get_context(request)
        context["has_password"] = False

        return MailPreview(
            text_template="sentry/emails/auth-sso-disabled.txt",
            html_template="sentry/emails/auth-sso-disabled.html",
            context=context,
        ).render(request)
