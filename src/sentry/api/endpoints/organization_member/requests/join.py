import logging

from django.db import IntegrityError
from django.db.models import Q
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import ratelimits as ratelimiter
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.auth.services.auth import auth_service
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.notifications.notifications.organization_request import JoinRequestNotification
from sentry.notifications.utils.tasks import async_send_notification
from sentry.signals import join_request_created
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.users.api.parsers.email import AllowedEmailField
from sentry.utils.demo_mode import is_demo_user

logger = logging.getLogger(__name__)


class JoinRequestSerializer(serializers.Serializer):
    email = AllowedEmailField(max_length=75, required=True)


def create_organization_join_request(organization, email, ip_address=None):
    with outbox_context(flush=False):
        om = OrganizationMember.objects.filter(
            Q(email__iexact=email)
            | Q(user_is_active=True, user_email__iexact=email, user_id__isnull=False),
            organization=organization,
        ).first()
        if om:
            return

        try:
            om = OrganizationMember.objects.create(
                organization_id=organization.id,
                role=organization.default_role,
                email=email,
                invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
            )
        except IntegrityError:
            pass

        return om


@region_silo_endpoint
class OrganizationJoinRequestEndpoint(OrganizationEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }
    # Disable authentication and permission requirements.
    permission_classes = ()

    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(limit=5, window=86400),
            RateLimitCategory.USER: RateLimit(limit=5, window=86400),
            RateLimitCategory.ORGANIZATION: RateLimit(limit=5, window=86400),
        }
    }

    def post(self, request: Request, organization) -> Response:
        if organization.get_option("sentry:join_requests") is False:
            return Response(
                {"detail": "Your organization does not allow join requests."}, status=403
            )

        if is_demo_user(request.user):
            return Response(status=403)

        # users can already join organizations with SSO enabled without an invite
        # so they should join that way and not through a request to the admins
        provider = auth_service.get_auth_provider(organization_id=organization.id)
        if provider is not None:
            return Response(status=403)

        ip_address = request.META["REMOTE_ADDR"]

        if ratelimiter.backend.is_limited(
            f"org-join-request:ip:{ip_address}",
            limit=5,
            window=86400,  # 5 per day, 60 x 60 x 24
        ):
            return Response({"detail": "Rate limit exceeded."}, status=429)

        serializer = JoinRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data
        email = result["email"]

        member = create_organization_join_request(organization, email, ip_address)

        if member:
            async_send_notification(JoinRequestNotification, member, request.user)
            # legacy analytics
            join_request_created.send_robust(sender=self, member=member)

        return Response(status=204)
