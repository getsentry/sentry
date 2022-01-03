from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import Organization, OrganizationMember

from .mail import MailPreview


class DebugSetup2faEmailView(View):
    def get(self, request: Request) -> Response:
        org = Organization(id=1, slug="organization", name="sentry corp")
        member = OrganizationMember(id=1, organization=org, email="test@gmail.com")
        context = {"url": member.get_invite_link(), "organization": org}
        return MailPreview(
            html_template="sentry/emails/setup_2fa.html",
            text_template="sentry/emails/setup_2fa.txt",
            context=context,
        ).render(request)
