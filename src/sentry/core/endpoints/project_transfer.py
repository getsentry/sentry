import logging
from typing import Any
from urllib.parse import urlencode
from uuid import uuid4

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, options, roles
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.api.decorators import sudo_required
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.models.options.project_option import ProjectOption
from sentry.models.organizationmember import OrganizationMember
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.signing import sign

delete_logger = logging.getLogger("sentry.deletions.api")

SALT = "sentry-project-transfer"


class ProjectTransferSerializer(serializers.Serializer):
    email = serializers.EmailField(
        required=True,
        help_text="The email of the organization owner to transfer the project to. "
        "Must be an owner of a different organization.",
    )


class RelaxedProjectPermission(ProjectPermission):
    scope_map = {"POST": ["org:admin"]}


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class ProjectTransferEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (RelaxedProjectPermission,)

    enforce_rate_limit = True

    def rate_limits(*args: Any, **kwargs: Any) -> RateLimitConfig:
        limit = options.get("api.project-transfer.rate-limit-overrides")
        return RateLimitConfig(
            limit_overrides={
                "POST": {
                    RateLimitCategory.USER: RateLimit(
                        limit=limit,
                        window=60 * 60,
                    ),
                },
            },
        )

    @extend_schema(
        operation_id="Transfer a Project",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, GlobalParams.PROJECT_ID_OR_SLUG],
        request=ProjectTransferSerializer,
        responses={
            204: RESPONSE_NO_CONTENT,
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    @sudo_required
    def post(self, request: Request, project) -> Response:
        """
        Schedule a project for transfer to a new organization.

        An email is sent to the target organization owner with a link to accept the
        transfer.
        """
        if project.is_internal_project():
            return Response(
                '{"error": "Cannot transfer projects internally used by Sentry."}',
                status=status.HTTP_403_FORBIDDEN,
            )

        email = request.data.get("email")

        if email is None:
            return Response(status=status.HTTP_400_BAD_REQUEST)

        if not request.user.is_authenticated:
            return Response(status=status.HTTP_403_FORBIDDEN)

        all_owners = OrganizationMember.objects.get_members_by_email_and_role(
            email=email,
            role=roles.get_top_dog().id,
        )
        owners = all_owners.exclude(organization_id=project.organization_id)

        if len(all_owners) > 0 and len(owners) == 0:
            return Response(
                {"detail": "Cannot transfer project to the same organization."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        unique_user_ids: set[int] = {owner.user_id for owner in owners}

        if len(unique_user_ids) == 0:
            return Response(
                {"detail": "Could not find an organization owner with that email"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if len(unique_user_ids) > 1:
            return Response(
                {
                    "detail": "That email belongs to multiple accounts. Contact the person and ensure the email is associated with only one account."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        transaction_id = uuid4().hex
        url_data = sign(
            salt=SALT,
            actor_id=request.user.id,
            from_organization_id=project.organization_id,
            project_id=project.id,
            user_id=unique_user_ids.pop(),
            transaction_id=transaction_id,
        )

        ProjectOption.objects.set_value(
            project, "sentry:project-transfer-transaction-id", transaction_id
        )

        context = {
            "email": email,
            "from_org": project.organization.name,
            "project_name": project.slug,
            "request_time": timezone.now(),
            "url": absolute_uri(f"/accept-transfer/?{urlencode({'data': url_data})}"),
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
            event=audit_log.get_event_id("PROJECT_REQUEST_TRANSFER"),
            data=project.get_audit_log_data(),
            transaction_id=transaction_id,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
