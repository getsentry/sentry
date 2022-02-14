from django.views.generic import View
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.models import Organization, OrganizationMember, Project, User
from sentry.notifications.notifications.codeowners_auto_sync import AutoSyncNotification
from sentry.web.frontend.debug.mail import MailPreviewAdapter
from sentry.web.helpers import render_to_response


class DebugCodeOwnersAutoSyncFailureView(View):
    def get(self, request: Request) -> Response:
        recipient_name = request.GET.get("recipient_name", "Recipient")

        org = Organization(id=1, slug="petal", name="Petal")
        project = Project(id=1, slug="nodejs", name="Node.js", organization=org)
        user = User(name=recipient_name)
        OrganizationMember(organization=org, user=user, role="admin")
        notification = AutoSyncNotification(project)
        mail_args = {
            "subject": notification.get_subject(),
            "type": notification.get_type(),
            "context": notification.get_context(),
            "template": notification.get_template(),
            "html_template": notification.get_html_template(),
        }
        preview = MailPreviewAdapter(**mail_args)

        return render_to_response("sentry/debug/mail/preview.html", {"preview": preview})
