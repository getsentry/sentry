from django.urls import reverse
from django.views.generic import View

from sentry.models import Organization, User
from sentry.utils.http import absolute_uri

from .mail import MailPreview


class DebugOrganizationInviteRequestEmailView(View):
    def get(self, request):
        org = Organization(id=1, slug="default", name="Default")
        user = User(name="Rick Swan")

        context = {
            "organization_name": org.name,
            "inviter_name": user.get_salutation_name,
            "email": "test@gmail.com",
            "pending_requests_link": absolute_uri(
                reverse("sentry-organization-members", args=[org.slug])
            ),
        }
        return MailPreview(
            html_template="sentry/emails/organization-invite-request.html",
            text_template="sentry/emails/organization-invite-request.txt",
            context=context,
        ).render(request)
