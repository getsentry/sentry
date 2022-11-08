from django.db import IntegrityError, transaction
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.base import Endpoint, control_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import BaseOrganizationSerializer
from sentry.models.organizationmapping import OrganizationMapping


class OrganizationMappingSerializer(serializers.Serializer):  # type: ignore
    organization_id = serializers.IntegerField(required=True)
    slug = serializers.RegexField(
        BaseOrganizationSerializer.slug_regex, max_length=50, required=True
    )
    stripe_id = serializers.CharField(max_length=255, required=True)
    idempotency_key = serializers.CharField(max_length=48, required=True)


@control_silo_endpoint
class OrganizationMappingsEndpoint(Endpoint):
    permission_classes = (OrganizationPermission,)

    def post(self, request: Request) -> Response:
        """
        Create a New Org Mapping for an Organization
        ``````````````````````````````````

        Creating an org mapping happens during the organization creation
        flow. Among other things, it reserves a globally unique slug and handles
        ensuring reserved slugs (eventually) accurately reflect the corresponding organization
        records in region silos.

        :pparam string organization_id: the id of the organization we're reserving a slug for
        :pparam string slug: the slug to reserve
        :param string stripe_id: a stripe unique identifier
        :param string idempotency_key: A pseudorandom string that allows requests to be repeated safely.
                    Recommended to be an md5sum(org_id + slug + stripe_id)
        :auth: required, user-context-needed
        """
        if not request.user.is_authenticated:
            return Response({"detail": "This endpoint requires user info"}, status=401)

        if not features.has("organizations:create", actor=request.user):
            return Response(
                {"detail": "Organizations are not allowed to be created by this user."}, status=401
            )

        serializer = OrganizationMappingSerializer(data=request.data)

        if serializer.is_valid():
            result = serializer.validated_data

            with transaction.atomic():
                try:
                    mapping = OrganizationMapping.objects.create(
                        organization_id=result["organization_id"],
                        slug=result.get("slug"),
                        stripe_id=result.get("stripe_id"),
                    )
                    return Response(serialize(mapping, request.user), status=201)
                except IntegrityError:
                    pass

            # If we got here, the slug already exists
            if result.get("idempotency_key") != "":
                try:
                    existing = OrganizationMapping.objects.get(
                        slug=result.get("slug"), idempotency_key=result.get("idempotency_key")
                    )
                    return Response(serialize(existing, request.user), status=201)
                except OrganizationMapping.DoesNotExist:
                    pass

            # The slug exists and the idempotency key does not match
            return Response(
                {"detail": "An organization with this slug already exists."}, status=409
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
