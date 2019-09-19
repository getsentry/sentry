from __future__ import absolute_import

import logging

from rest_framework import serializers
from rest_framework.response import Response
from django.db import IntegrityError, transaction
from django.db.models import Q

from sentry import experiments
from sentry.api.base import Endpoint
from sentry.api.validators import AllowedEmailField
from sentry.app import ratelimiter
from sentry.models import AuthProvider, InviteStatus, Organization, OrganizationMember

logger = logging.getLogger(__name__)


class RequestJoinSerializer(serializers.Serializer):
    email = AllowedEmailField(max_length=75, required=True)
    orgSlug = serializers.RegexField(r"^[a-z0-9_\-]+$", max_length=50, required=True)


class RequestJoinOrganization(Endpoint):
    # Disable authentication and permission requirements.
    permission_classes = []

    def post(self, request):
        ip_address = request.META["REMOTE_ADDR"]

        if ratelimiter.is_limited(
            u"request-join:ip:{}".format(ip_address), limit=5, window=60  # 5 per minute
        ):
            return Response({"detail": "Rate limit exceeded."}, status=429)

        serializer = RequestJoinSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data
        org_slug = result["orgSlug"]
        email = result["email"]

        try:
            organization = Organization.objects.get(slug=org_slug)
        except Organization.DoesNotExist:
            return Response(status=400)

        assignment = experiments.get(org=organization, experiment_name="RequestJoinExperiment")
        if assignment != 1:
            return Response(status=403)

        # users can already join organizations with SSO enabled without an invite
        # so no need to allow requests to join as well
        auth_provider = AuthProvider.objects.filter(organization=organization).exists()
        if auth_provider:
            return Response(status=403)

        existing = OrganizationMember.objects.filter(
            Q(email__iexact=email) | (Q(user__is_active=True) & Q(user__email__iexact=email)),
            organization=organization,
        ).exists()

        if not existing:
            try:
                with transaction.atomic():
                    om = OrganizationMember.objects.create(
                        organization=organization,
                        email=email,
                        invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
                    )
            except IntegrityError:
                pass
            else:
                logger.info(
                    "request-join.created",
                    extra={
                        "organization_id": organization.id,
                        "member_id": om.id,
                        "email": email,
                        "ip_address": ip_address,
                    },
                )

        return Response(status=204)
