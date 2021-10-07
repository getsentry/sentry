from django.views.generic import View

from sentry.api.endpoints.project_codeowners_request import get_codeowners_request_builder_args
from sentry.models import Organization, OrganizationMember, Project, User
from sentry.web.frontend.debug.mail import MailPreviewAdapter
from sentry.web.helpers import render_to_response


class DebugCodeOwnersRequestView(View):
    def get(self, request):
        requester_name = request.GET.get("requester_name", "Requester")
        recipient_name = request.GET.get("recipient_name", "Recipient")

        org = Organization(id=1, slug="petal", name="Petal")
        project = Project(id=1, slug="nodejs", name="Node.js", organization=org)
        user = User(name=recipient_name)
        member = OrganizationMember(organization=org, user=user, role="admin")
        preview = MailPreviewAdapter(
            **get_codeowners_request_builder_args(project, member, requester_name)
        )

        return render_to_response("sentry/debug/mail/preview.html", {"preview": preview})
