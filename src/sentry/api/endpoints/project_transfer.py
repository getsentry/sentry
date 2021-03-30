import logging
from urllib.parse import urlencode
from uuid import uuid4

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from sentry import options, roles
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.decorators import sudo_required
from sentry.models import AuditLogEntryEvent, OrganizationMember
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign

delete_logger = logging.getLogger("sentry.deletions.api")


class RelaxedProjectPermission(ProjectPermission):
    scope_map = {"POST": ["project:admin"]}


class ProjectTransferEndpoint(ProjectEndpoint):
    permission_classes = [RelaxedProjectPermission]

    @sudo_required
    def post(self, request, project):
        """
        Transfer a Project
        ````````````````

        Schedules a project for transfer to a new organization.

        :pparam string organization_slug: the slug of the organization the
                                          project belongs to.
        :pparam string project_slug: the slug of the project to delete.
        :param string email: email of new owner. must be an organization owner
        :auth: required
        """
        if project.is_internal_project():
            return Response(
                '{"error": "Cannot transfer projects internally used by Sentry."}',
                status=status.HTTP_403_FORBIDDEN,
            )

        email = request.data.get("email")

        if email is None:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not request.user.is_authenticated():
            return Response(status=status.HTTP_403_FORBIDDEN)

        try:
            owner = OrganizationMember.objects.filter(
                user__email__iexact=email, role=roles.get_top_dog().id, user__is_active=True
            )[0]
        except IndexError:
            return Response(
                {"detail": "Could not find an organization owner with that email"},
                status=status.HTTP_404_NOT_FOUND,
            )

        transaction_id = uuid4().hex
        url_data = sign(
            actor_id=request.user.id,
            from_organization_id=project.organization.id,
            project_id=project.id,
            user_id=owner.user_id,
            transaction_id=transaction_id,
        )

        context = {
            "email": email,
            "from_org": project.organization.name,
            "project_name": project.slug,
            "request_time": timezone.now(),
            "url": absolute_uri("/accept-transfer/") + "?" + urlencode({"data": url_data}),
            "requester": request.user,
        }
        MessageBuilder(
            subject="{}Request for Project Transfer".format(options.get("mail.subject-prefix")),
            template="sentry/emails/transfer_project.txt",
            html_template="sentry/emails/transfer_project.html",
            type="org.confirm_project_transfer_request",
            context=context,
        ).send_async([email])

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=AuditLogEntryEvent.PROJECT_REQUEST_TRANSFER,
            data=project.get_audit_log_data(),
            transaction_id=transaction_id,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
