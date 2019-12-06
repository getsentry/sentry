from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from django.views.generic import View

from sentry.models import Organization
from sentry.utils.http import absolute_uri

from .mail import MailPreview


class DebugOrganizationJoinRequestEmailView(View):
    def get(self, request):
        org = Organization(id=1, slug="default", name="Default")
        context = {
            "organization_name": org.name,
            "email": "test@gmail.com",
            "pending_requests_link": absolute_uri(
                reverse("sentry-organization-members-requests", args=[org.slug])
            ),
            "settings_link": absolute_uri(reverse("sentry-organization-settings", args=[org.slug])),
        }
        return MailPreview(
            html_template="sentry/emails/organization-join-request.html",
            text_template="sentry/emails/organization-join-request.txt",
            context=context,
        ).render(request)
