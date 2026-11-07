from datetime import UTC, datetime
from typing import Any

from django.core.exceptions import ValidationError
from django.db.models import Value
from django.db.models.functions import Coalesce
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, roles
from sentry.analytics.events.org_auth_token_created import OrgAuthTokenCreated
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import (
    SessionNoAuthTokenAuthentication,
    UserAuthTokenAuthentication,
)
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import (
    ControlSiloOrganizationEndpoint,
    OrgAuthTokenPermission,
    get_issuing_token_audit_log_data,
)
from sentry.api.exceptions import InsufficientScope
from sentry.api.permissions import DisallowImpersonatedTokenCreation
from sentry.api.serializers import serialize
from sentry.api.utils import generate_locality_url
from sentry.auth.principal import acting_user_id
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.orgauthtoken import (
    DEFAULT_ORG_AUTH_TOKEN_SCOPES,
    MAX_NAME_LENGTH,
    ORG_AUTH_TOKEN_ALLOWED_SCOPES,
    ORG_AUTH_TOKEN_FORBIDDEN_SCOPES,
    OrgAuthToken,
)
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.security.utils import capture_security_activity
from sentry.types.cell import get_locality_name_for_cell
from sentry.users.models.user import User
from sentry.utils.security.orgauthtoken_token import (
    SystemUrlPrefixMissingException,
    generate_token,
    hash_token,
)


class OrgAuthTokenCreateSerializer(serializers.Serializer[dict[str, Any]]):
    # Name errors are reported by the endpoint with its existing specific messages.
    name = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, trim_whitespace=False
    )
    scopes = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=False,
        default=lambda: list(DEFAULT_ORG_AUTH_TOKEN_SCOPES),
    )


@control_silo_endpoint
class OrganizationAuthTokensEndpoint(ControlSiloOrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.FOUNDATIONS
    authentication_classes = (SessionNoAuthTokenAuthentication, UserAuthTokenAuthentication)
    permission_classes = (OrgAuthTokenPermission, DisallowImpersonatedTokenCreation)

    @method_decorator(never_cache)
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        # We want to sort by date_last_used, but sort NULLs last
        the_past = datetime.min.replace(tzinfo=UTC)

        token_list = list(
            OrgAuthToken.objects.filter(
                organization_id=organization.id, date_deactivated__isnull=True
            )
            .annotate(last_used_non_null=Coalesce("date_last_used", Value(the_past)))
            .order_by("-last_used_non_null", "name", "-date_added")
        )

        return Response(serialize(token_list, request.user, token=None))

    def post(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        try:
            org_mapping = OrganizationMapping.objects.get(organization_id=organization.id)
            token_str = generate_token(
                organization.slug,
                generate_locality_url(get_locality_name_for_cell(org_mapping.cell_name)),
            )
        except SystemUrlPrefixMissingException:
            return Response(
                {
                    "detail": {
                        "message": "system.url-prefix is not set. You need to set this to generate a token.",
                        "code": "missing_system_url_prefix",
                    }
                },
                status=400,
            )

        token_hashed = hash_token(token_str)

        serializer = OrgAuthTokenCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)
        name = serializer.validated_data.get("name")
        scopes = serializer.validated_data["scopes"]

        # Main validation cases with specific error messages
        if not name:
            return Response({"detail": "The name cannot be blank."}, status=400)

        if len(name) > MAX_NAME_LENGTH:
            return Response(
                {"detail": "The name cannot be longer than 255 characters."}, status=400
            )

        disallowed_scopes = {
            scope
            for scope in scopes
            if scope not in ORG_AUTH_TOKEN_ALLOWED_SCOPES
            or scope in ORG_AUTH_TOKEN_FORBIDDEN_SCOPES
        }
        if disallowed_scopes:
            return Response(
                {
                    "detail": "Org auth tokens cannot be granted: "
                    + ", ".join(sorted(disallowed_scopes))
                },
                status=400,
            )

        # A token-authenticated caller (an OAuth app token, per OrgAuthTokenPermission) can
        # only mint a token with a subset of its own scopes.
        if request.auth is not None:
            missing_scopes = {scope for scope in scopes if not request.auth.has_scope(scope)}
            if missing_scopes:
                raise InsufficientScope(missing_scopes)

        token = OrgAuthToken.objects.create(
            name=name,
            organization_id=organization.id,
            scope_list=sorted(set(scopes)),
            created_by_id=acting_user_id(request.user),
            token_last_characters=token_str[-4:],
            token_hashed=token_hashed,
        )

        try:
            token.full_clean()
        except ValidationError as e:
            return Response({"detail": list(e.messages)}, status=400)

        self.create_audit_entry(
            request,
            organization=organization,
            target_object=token.id,
            event=audit_log.get_event_id("ORGAUTHTOKEN_ADD"),
            data={**token.get_audit_log_data(), **get_issuing_token_audit_log_data(request)},
        )

        # Notify all owners of org of new token
        owner_ids = OrganizationMemberMapping.objects.filter(
            organization_id=organization.id, role=roles.get_top_dog().id
        ).values_list("user_id", flat=True)
        owners = User.objects.filter(id__in=owner_ids)

        for owner in owners:
            capture_security_activity(
                account=owner,
                type="org-auth-token-created",
                actor=request.user,
                ip_address=request.META["REMOTE_ADDR"],
                context={"organization": organization, "token_name": token.name},
                send_email=True,
            )

        analytics.record(
            OrgAuthTokenCreated(
                user_id=acting_user_id(request.user),
                organization_id=organization.id,
            )
        )

        # This is THE ONLY TIME that the token is available
        serialized_token = serialize(token, request.user, token=token_str)

        if serialized_token is None:
            return Response({"detail": "Error when serializing token."}, status=400)

        return Response(serialized_token, status=status.HTTP_201_CREATED)
