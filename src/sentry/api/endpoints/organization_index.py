import logging

from django.conf import settings
from django.db import IntegrityError
from drf_spectacular.utils import extend_schema
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, features, options
from sentry import ratelimits as ratelimiter
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import (
    BaseOrganizationSerializer,
    OrganizationSerializerResponse,
)
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.user_examples import UserExamples
from sentry.apidocs.parameters import CursorQueryParam, OrganizationParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.superuser import is_active_superuser
from sentry.hybridcloud.rpc import IDEMPOTENCY_KEY_LENGTH
from sentry.models.organization import Organization
from sentry.organizations.services.organization import organization_service
from sentry.services.organization import (
    OrganizationOptions,
    OrganizationProvisioningOptions,
    PostProvisionOptions,
)
from sentry.services.organization.provisioning import organization_provisioning_service
from sentry.signals import org_setup_complete, terms_accepted

logger = logging.getLogger(__name__)


class OrganizationPostSerializer(BaseOrganizationSerializer):
    defaultTeam = serializers.BooleanField(required=False)
    agreeTerms = serializers.BooleanField(required=True)
    aggregatedDataConsent = serializers.BooleanField(required=False)
    idempotencyKey = serializers.CharField(max_length=IDEMPOTENCY_KEY_LENGTH, required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not (settings.TERMS_URL and settings.PRIVACY_URL):
            del self.fields["agreeTerms"]
        self.fields["slug"].required = False
        self.fields["name"].required = True

    def validate_agreeTerms(self, value):
        if not value:
            raise serializers.ValidationError("This attribute is required.")
        return value


@extend_schema(tags=["Users"])
@region_silo_endpoint
class OrganizationIndexEndpoint(Endpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationPermission,)

    @extend_schema(
        operation_id="List Your Organizations",
        parameters=[
            OrganizationParams.OWNER,
            CursorQueryParam,
            OrganizationParams.QUERY,
            OrganizationParams.SORT_BY,
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizations", list[OrganizationSerializerResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=UserExamples.LIST_ORGANIZATIONS,
    )
    def get(self, request: Request) -> Response:
        """
        Return a list of organizations available to the authenticated session in a region.
        This is particularly useful for requests with a user bound context. For API key-based requests this will only return the organization that belongs to the key.
        """
        result = organization_service.list_organizations(
            actor_user_id=request.user.id,
            owner_only=request.GET.get("owner") in ("1", "true"),
            query=request.GET.get("query"),
            sort_by=request.GET.get("sortBy"),
            show=request.GET.get("show"),
            actor_organization_id=request.auth.organization_id if request.auth else None,
            actor_project_id=request.auth.project_id if request.auth else None,
            actor_is_active_superuser=is_active_superuser(request),
            as_user=request.user,
        )

        response = Response(result["results"])
        self.add_cursor_headers(request, response, result["cursor"])
        return response

    # XXX: endpoint useless for end-users as it needs user context.
    def post(self, request: Request) -> Response:
        """
        Create a New Organization
        `````````````````````````

        Create a new organization owned by the request's user.  To create
        an organization only the name is required.

        :param string name: the human readable name for the new organization.
        :param string slug: the unique URL slug for this organization.  If
                            this is not provided a slug is automatically
                            generated based on the name.
        :param bool agreeTerms: a boolean signaling you agree to the applicable
                                terms of service and privacy policy.
        :auth: required, user-context-needed
        """
        if not request.user.is_authenticated:
            return Response({"detail": "This endpoint requires user info"}, status=401)

        if not features.has("organizations:create", actor=request.user):
            return Response(
                {"detail": "Organizations are not allowed to be created by this user."}, status=401
            )

        limit = options.get("api.rate-limit.org-create")
        if limit and ratelimiter.backend.is_limited(
            f"org-create:{request.user.id}", limit=limit, window=3600
        ):
            return Response(
                {"detail": "You are attempting to create too many organizations too quickly."},
                status=429,
            )

        serializer = OrganizationPostSerializer(data=request.data)

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
                region_name=settings.SENTRY_REGION or settings.SENTRY_MONOLITH_REGION,
                provisioning_options=provision_args,
            )
            org = Organization.objects.get(id=rpc_org.id)

            org_setup_complete.send_robust(
                instance=org, user=request.user, sender=self.__class__, referrer="in-app"
            )

            self.create_audit_entry(
                request=request,
                organization=org,
                target_object=org.id,
                event=audit_log.get_event_id("ORG_ADD"),
                data=org.get_audit_log_data(),
            )

            analytics.record(
                "organization.created",
                org,
                actor_id=request.user.id if request.user.is_authenticated else None,
            )

        # TODO(hybrid-cloud): We'll need to catch a more generic error
        # when the internal RPC is implemented.
        except IntegrityError:
            return Response(
                {"detail": "An organization with this slug already exists."}, status=409
            )

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

            analytics.record(
                "aggregated_data_consent.organization_created",
                organization_id=org.id,
            )

        # New organizations should not see the legacy UI
        org.update_option("sentry:streamline_ui_only", True)

        return Response(serialize(org, request.user), status=201)
