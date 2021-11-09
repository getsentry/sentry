import logging

from django.utils.translation import ugettext as _

from sentry import roles
from sentry.api.bases.project_request_change import ProjectRequestChangeEndpoint
from sentry.models import OrganizationMember
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)


def get_codeowners_request_builder_args(project, recipient, requester_name):
    return {
        "subject": _("A team member is asking to set up Sentry's Code Owners"),
        "type": "organization.codeowners-request",
        "context": {
            "requester_name": requester_name,
            "recipient_name": recipient.get_display_name(),
            "organization_name": project.organization.name,
            "project_name": project.name,
            "codeowners_url": absolute_uri(
                f"/settings/{project.organization.slug}/projects/{project.slug}/ownership/?referrer=codeowners-email"
            ),
        },
        "template": "sentry/emails/requests/codeowners.txt",
        "html_template": "sentry/emails/requests/codeowners.html",
    }


class ProjectCodeOwnersRequestEndpoint(ProjectRequestChangeEndpoint):
    def post(self, request, project):
        """
        Request to Add CODEOWNERS to a Project
        ````````````````````````````````````
        :pparam string organization_slug: the slug of the organization the member will belong to
        :pparam string project_slug: the slug of the project
        :auth: required
        """

        requester_name = request.user.get_display_name()
        integrations_roles = [r.id for r in roles.get_all() if r.has_scope("org:integrations")]
        recipients = OrganizationMember.objects.get_contactable_members_for_org(
            project.organization.id
        ).filter(role__in=integrations_roles)

        for recipient in recipients:
            msg = MessageBuilder(
                **get_codeowners_request_builder_args(project, recipient, requester_name)
            )
            email = recipient.get_email()
            logger.info(
                "send_email", extra={"organization_id": project.organization.id, "email": email}
            )
            msg.send_async([email])

        return self.respond(status=202)
