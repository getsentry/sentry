from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from django.views.generic import View

from sentry.models import Organization, User
from sentry.utils.http import absolute_uri

from .mail import MailPreview


class DebugOrganizationInviteRequestEmailView(View):
    def get(self, request):
        org = Organization(id=1, slug="default", name="Default")
        user = User(name="Rick Swan")

        context = {
            "organization": org,
            "inviter": user,
            "email": "test@gmail.com",
            "organization_link": absolute_uri(
                reverse("sentry-organization-index", args=[org.slug])
            ),
            "pending_requests_link": absolute_uri(
                reverse("sentry-organization-members-requests", args=[org.slug])
            ),
        }
        return MailPreview(
            html_template="sentry/emails/organization-invite-request.html",
            text_template="sentry/emails/organization-invite-request.txt",
            context=context,
        ).render(request)
