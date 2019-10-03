from __future__ import absolute_import

import logging

from rest_framework import serializers
from rest_framework.response import Response
from django.db import IntegrityError
from django.db.models import Q

from sentry import experiments
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.validators import AllowedEmailField
from sentry.app import ratelimiter
from sentry.models import AuthProvider, InviteStatus, OrganizationMember

JOIN_REQUEST_EXPERIMENT = "JoinRequestExperiment"

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
        om = OrganizationMember.objects.create(
            organization=organization,
            email=email,
            invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
        )
    except IntegrityError:
        pass
    else:
        logger.info(
            "org-join-request.created",
            extra={
                "organization_id": organization.id,
                "member_id": om.id,
                "email": email,
                "ip_address": ip_address,
            },
        )


class OrganizationJoinRequestEndpoint(OrganizationEndpoint):
    # Disable authentication and permission requirements.
    permission_classes = []

    def post(self, request, organization):
        assignment = experiments.get(org=organization, experiment_name=JOIN_REQUEST_EXPERIMENT)
        if assignment != 1:
            return Response(status=403)

        if bool(organization.flags.disable_join_requests):
            return Response(
                {"detail": "Your organization does not allow access requests."}, status=403
            )

        # users can already join organizations with SSO enabled without an invite
        # so no need to allow requests to join as well
        if AuthProvider.objects.filter(organization=organization).exists():
            return Response(status=403)

        ip_address = request.META["REMOTE_ADDR"]

        if ratelimiter.is_limited(
            u"org-join-request:ip:{}".format(ip_address), limit=5, window=60  # 5 per minute
        ):
            return Response({"detail": "Rate limit exceeded."}, status=429)

        serializer = JoinRequestSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data
        email = result["email"]

        create_organization_join_request(organization, email, ip_address)
        return Response(status=204)
