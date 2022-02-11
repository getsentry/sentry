from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import Organization, OrganizationMember, Project, User
from sentry.tasks.codeowners import get_codeowners_auto_sync_failure_email_builder_args
from sentry.web.frontend.debug.mail import MailPreviewAdapter
from sentry.web.helpers import render_to_response


class DebugCodeOwnersAutoSyncFailureView(View):
    def get(self, request: Request) -> Response:
        recipient_name = request.GET.get("recipient_name", "Recipient")

        org = Organization(id=1, slug="petal", name="Petal")
        project = Project(id=1, slug="nodejs", name="Node.js", organization=org)
        user = User(name=recipient_name)
        OrganizationMember(organization=org, user=user, role="admin")
        preview = MailPreviewAdapter(**get_codeowners_auto_sync_failure_email_builder_args(project))

        return render_to_response("sentry/debug/mail/preview.html", {"preview": preview})
