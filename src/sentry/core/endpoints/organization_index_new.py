import sentry_sdk
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, features, options
from sentry import ratelimits as ratelimiter
from sentry.analytics.events.data_consent_org_creation import (
    AggregatedDataConsentOrganizationCreatedEvent,
)
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, all_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.core.endpoints.organization_index import (
    OrganizationIndexEndpointLegacy,
    OrganizationPostSerializer,
)
from sentry.hybridcloud.rpc.service import RpcException
from sentry.organizations.services.organization import organization_service
from sentry.services.organization import (
    OrganizationOptions,
    OrganizationProvisioningOptions,
    PostProvisionOptions,
)
from sentry.services.organization.provisioning import organization_provisioning_service
from sentry.signals import terms_accepted
from sentry.silo.base import SiloMode
from sentry.types.region import find_all_multitenant_region_names


class OrganizationPostSerializerWithRegion(OrganizationPostSerializer):
    locality = serializers.CharField(required=True)

    def validate_locality(self, value) -> str:
        # TODO(cells): this should eventually become find_all_localities not all cells
        if value not in find_all_multitenant_region_names():
            raise serializers.ValidationError("Invalid region.")
        return value


@extend_schema(tags=["Users"])
@all_silo_endpoint
class OrganizationIndexEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationPermission,)

    def get(self, request: Request) -> Response:
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            # TODO: Implement the new logic for GET request here
            return Response({"detail": "Not yet implemented."})

        # If we are in region or monolith mode, apply legacy behavior for now
        return OrganizationIndexEndpointLegacy.as_view()(request)

    def post(self, request: Request) -> Response:
        # If we are in control, call the legacy endpoint
        # If we are in region or monolith mode, apply legacy behavior for now
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            if not request.user.is_authenticated:
                return Response({"detail": "This endpoint requires user info"}, status=401)

            if not features.has("organizations:create", actor=request.user):
                return Response(
                    {"detail": "Organizations are not allowed to be created by this user."},
                    status=401,
                )

            limit = options.get("api.rate-limit.org-create")
            if limit and ratelimiter.backend.is_limited(
                f"org-create:{request.user.id}", limit=limit, window=3600
            ):
                return Response(
                    {"detail": "You are attempting to create too many organizations too quickly."},
                    status=429,
                )

            serializer = OrganizationPostSerializerWithRegion(data=request.data)

            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            result = serializer.validated_data

            try:
                create_default_team = bool(result.get("defaultTeam"))
                provision_args = OrganizationProvisioningOptions(
                    provision_options=OrganizationOptions(
                        name=result["name"],
                        slug=result.get("slug") or result["name"],
                        owning_user_id=request.user.id,
                        create_default_team=create_default_team,
                    ),
                    post_provision_options=PostProvisionOptions(
                        getsentry_options=None, sentry_options=None
                    ),
                )

                rpc_org = organization_provisioning_service.provision_organization_in_region(
                    region_name=result["region"],
                    provisioning_options=provision_args,
                )

                user_org = organization_service.get_organization_by_id(id=rpc_org.id)
                if user_org is None:
                    return Response(
                        {"detail": "Organization could not be found after creation."},
                        status=500,
                    )
                org = user_org.organization

            except RpcException as e:
                return Response({"detail": str(e)}, status=400)

            # failure on sending this signal is acceptable
            if result.get("agreeTerms"):
                terms_accepted.send_robust(
                    user=request.user,
                    organization_id=org.id,
                    ip_address=request.META["REMOTE_ADDR"],
                    sender=type(self),
                )

            if result.get("aggregatedDataConsent"):
                org.update_option("sentry:aggregated_data_consent", True)

                try:
                    analytics.record(
                        AggregatedDataConsentOrganizationCreatedEvent(
                            organization_id=org.id,
                        )
                    )
                except Exception as e:
                    sentry_sdk.capture_exception(e)

            # New organizations should not see the legacy UI
            org.update_option("sentry:streamline_ui_only", True)

            serialized_org = organization_service.serialize_organization(rpc_org.id, request.user)

            return Response(serialized_org, status=201)

        else:
            # If we are in region or monolith mode, apply legacy behavior for now
            return OrganizationIndexEndpointLegacy.as_view()(request)
