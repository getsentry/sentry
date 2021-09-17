import logging

from django.utils.translation import ugettext as _
from rest_framework import status
from rest_framework.exceptions import ValidationError

from sentry import roles
from sentry.api.bases.organization_request_change import OrganizationRequestChangeEndpoint
from sentry.models import OrganizationMember, Project
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)


class OrganizationCodeOwnersRequestEndpoint(OrganizationRequestChangeEndpoint):
    def post(self, request, organization):
        """
        Add a invite request to Organization
        ````````````````````````````````````

        Creates an invite request given an email and suggested role / teams.

        :pparam string organization_slug: the slug of the organization the member will belong to
        :param string projectId: the id of the project

        :auth: required
        """
        if not request.data.get("projectId"):
            raise ValidationError(
                "Missing projectId body parameter.", code=status.HTTP_400_BAD_REQUEST
            )
        try:
            project = Project.objects.get(id=request.data["projectId"], organization=organization)
        except Project.DoesNotExist:
            raise ValidationError("Invalid projectId.", code=status.HTTP_400_BAD_REQUEST)

        requester_name = request.user.get_display_name()
        integrations_roles = [r.id for r in roles.get_all() if r.has_scope("org:integrations")]
        recipients = OrganizationMember.objects.get_contactable_members_for_org(
            organization.id
        ).filter(role__in=integrations_roles)

        for recipient in recipients:
            msg = MessageBuilder(
                **{
                    "subject": _("A team member is asking to setup Sentry's Code Owners"),
                    "type": "organization.codeowners-request",
                    "context": {
                        "requester_name": requester_name,
                        "organization_name": organization.name,
                        "project_name": project.name,
                        "codeowners_url": absolute_uri(
                            f"/settings/{organization.slug}/projects/{project.slug}/ownership/"
                        ),
                    },
                    "template": "emails/codeowners-request/body.txt",
                    "html_template": "emails/codeowners-request/body.html",
                }
            )
            email = recipient.get_email()
            logger.info("send_email", extra={"organization_id": organization.id, "email": email})
            msg.send_async([email])

        return self.respond(status=202)
