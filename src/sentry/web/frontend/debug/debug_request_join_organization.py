from __future__ import absolute_import, print_function

from django.core.urlresolvers import reverse
from django.views.generic import View

from sentry.models import Organization
from sentry.utils.http import absolute_uri

from .mail import MailPreview


class DebugRequestJoinOrganizationEmailView(View):
    def get(self, request):
        org = Organization(id=1, slug="default", name="Default")
        context = {
            "organization": org,
            "email": "test@gmail.com",
            "pending_requests_link": absolute_uri(
                reverse("sentry-organization-members", args=[org.slug])
            ),
            "organization_link": absolute_uri(
                reverse("sentry-organization-index", args=[org.slug])
            ),
        }
        return MailPreview(
            html_template="sentry/emails/request-join-organization.html",
            text_template="sentry/emails/request-join-organization.txt",
            context=context,
        ).render(request)
