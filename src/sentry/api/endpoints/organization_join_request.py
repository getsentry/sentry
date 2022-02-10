import logging

from django.db import IntegrityError
from django.db.models import Q
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.validators import AllowedEmailField
from sentry.app import ratelimiter
from sentry.models import AuthProvider, InviteStatus, OrganizationMember
from sentry.notifications.notifications.organization_request import JoinRequestNotification
from sentry.notifications.utils.tasks import async_send_notification
from sentry.signals import join_request_created
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


class JoinRequestSerializer(serializers.Serializer):
    email = AllowedEmailField(max_length=75, required=True)


def create_organization_join_request(organization, email, ip_address=None):
    if OrganizationMember.objects.filter(
        Q(email__iexact=email) | Q(user__is_active=True, user__email__iexact=email),
        organization=organization,
    ).exists():
        return

    try:
        return OrganizationMember.objects.create(
            organization=organization,
            email=email,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )
    except IntegrityError:
        pass


class OrganizationJoinRequestEndpoint(OrganizationEndpoint):
    # Disable authentication and permission requirements.
    permission_classes = []

    rate_limits = {
        "POST": {
            RateLimitCategory.IP: RateLimit(5, 86400),
            RateLimitCategory.USER: RateLimit(5, 86400),
            RateLimitCategory.ORGANIZATION: RateLimit(5, 86400),
        }
    }

    def post(self, request: Request, organization) -> Response:
        if organization.get_option("sentry:join_requests") is False:
            return Response(
                {"detail": "Your organization does not allow join requests."}, status=403
            )

        # users can already join organizations with SSO enabled without an invite
        # so they should join that way and not through a request to the admins
        if AuthProvider.objects.filter(organization=organization).exists():
            return Response(status=403)

        ip_address = request.META["REMOTE_ADDR"]

        if ratelimiter.is_limited(
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
