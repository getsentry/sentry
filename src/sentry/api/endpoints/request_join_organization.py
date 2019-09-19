from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response
from django.db import IntegrityError
from django.db.models import Q

from sentry import experiments
from sentry.api.base import Endpoint
from sentry.api.validators import AllowedEmailField
from sentry.app import ratelimiter
from sentry.models import AuthProvider, InviteStatus, Organization, OrganizationMember

ERR_INVALID_ORG = "Invalid organization"
ERR_LIMITED = "Rate limit exceeded"
ERR_FAILED = "Request to join attempt failed"


class RequestJoinSerializer(serializers.Serializer):
    email = AllowedEmailField(max_length=75, required=True)
    orgSlug = serializers.RegexField(r"^[a-z0-9_\-]+$", max_length=50, required=True)

    def validate(self, attrs):
        org_slug = attrs.get("orgSlug")

        try:
            organization = Organization.objects.get(slug=org_slug)
        except Organization.DoesNotExist:
            raise serializers.ValidationError({"orgSlug": ERR_INVALID_ORG})

        assignment = experiments.get(org=organization, experiment_name="RequestJoinExperiment")
        if assignment != 1:
            raise serializers.ValidationError({"orgSlug": ERR_INVALID_ORG})

        # users can already join organizations with SSO enabled without an invite
        # so no need to allow requests to join as well
        if AuthProvider.objects.filter(organization=organization).exists():
            raise serializers.ValidationError({"orgSlug": ERR_INVALID_ORG})

        attrs["organization"] = organization
        return attrs


class RequestJoinOrganization(Endpoint):
    # Disable authentication and permission requirements.
    permission_classes = []

    def post(self, request):
        ip_address = request.META["REMOTE_ADDR"]

        if ratelimiter.is_limited(
            u"request-join:ip:{}".format(ip_address), limit=10, window=60  # 10 per minute
        ):
            return Response({"detail": ERR_LIMITED}, status=429)

        serializer = RequestJoinSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data
        organization = result["organization"]
        email = result["email"]

        existing = OrganizationMember.objects.filter(
            Q(email__iexact=email) | (Q(user__is_active=True) & Q(user__email__iexact=email)),
            organization=organization,
        ).exists()

        if not existing:
            try:
                OrganizationMember.objects.create(
                    organization=organization,
                    email=email,
                    invite_status=InviteStatus.REQUESTED_TO_JOIN.value,
                )
            except IntegrityError:
                return Response({"detail": ERR_FAILED}, status=400)

        return Response(status=204)
