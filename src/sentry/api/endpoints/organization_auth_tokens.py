from datetime import UTC, datetime
from typing import Any, TypedDict

from django.core.exceptions import ValidationError
from django.db.models import Value
from django.db.models.functions import Coalesce
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from drf_spectacular.utils import extend_schema
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
from sentry.api.serializers.models.orgauthtoken import (
    OrgAuthTokenSerializer,
    OrgAuthTokenSerializerResponse,
)
from sentry.api.utils import generate_locality_url
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
)
from sentry.apidocs.examples.org_auth_token_examples import OrgAuthTokenExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import (
    DetailResponse,
    ValidationErrorResponse,
    as_validation_errors,
)
from sentry.apidocs.utils import inline_sentry_response_serializer
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


class _CodedErrorDetail(TypedDict):
    message: str
    code: str


class _CodedErrorResponse(TypedDict):
    detail: _CodedErrorDetail


class _ModelValidationErrorResponse(TypedDict):
    detail: list[str]


class OrgAuthTokenCreateSerializer(serializers.Serializer[dict[str, Any]]):
    # Name errors are reported by the endpoint with its existing specific messages.
    name = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        trim_whitespace=False,
        help_text="Required. A name for the token, up to 255 characters, to tell it apart from the organization's other tokens.",
    )
    scopes = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=False,
        default=lambda: list(DEFAULT_ORG_AUTH_TOKEN_SCOPES),
        help_text='Scopes to grant the token. Org auth tokens can only be granted `org:ci`, which is also the default: `["org:ci"]`.',
    )


@extend_schema(tags=["Organizations"])
@control_silo_endpoint
class OrganizationAuthTokensEndpoint(ControlSiloOrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    # Every POST mints a new token, records an audit log entry and emails the owners.
    idempotent_methods = frozenset()
    owner = ApiOwner.FOUNDATIONS
    authentication_classes = (SessionNoAuthTokenAuthentication, UserAuthTokenAuthentication)
    permission_classes = (OrgAuthTokenPermission, DisallowImpersonatedTokenCreation)

    @extend_schema(
        operation_id="listOrganizationAuthTokens",
        summary="List an Organization's Org Auth Tokens",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "OrgAuthTokenListResponse", list[OrgAuthTokenSerializerResponse]
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrgAuthTokenExamples.LIST_ORG_AUTH_TOKENS,
    )
    @method_decorator(never_cache)
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response[list[OrgAuthTokenSerializerResponse]]:
        """
        Return an organization's active org auth tokens, most recently used first, with
        tokens that were never used last. The list is not paginated.

        The response never includes a token's value, only its last four characters. The full
        token is returned once, by the request that creates it.

        Org auth tokens can be managed from a signed-in session, or with an OAuth application
        token that has the `org:tokens` scope in addition to one of the scopes listed here.
        Personal auth tokens, org auth tokens and integration tokens can't call this endpoint
        and get a 403.
        """
        # We want to sort by date_last_used, but sort NULLs last
        the_past = datetime.min.replace(tzinfo=UTC)

        token_list = list(
            OrgAuthToken.objects.filter(
                organization_id=organization.id, date_deactivated__isnull=True
            )
            .annotate(last_used_non_null=Coalesce("date_last_used", Value(the_past)))
            .order_by("-last_used_non_null", "name", "-date_added")
        )

        body: list[OrgAuthTokenSerializerResponse] = serialize(token_list, request.user, token=None)
        return Response(body)

    @extend_schema(
        operation_id="createOrganizationAuthToken",
        summary="Create an Org Auth Token",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=OrgAuthTokenCreateSerializer,
        responses={
            201: OrgAuthTokenSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrgAuthTokenExamples.CREATE_ORG_AUTH_TOKEN,
    )
    def post(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> (
        Response[OrgAuthTokenSerializerResponse]
        | Response[DetailResponse]
        | Response[ValidationErrorResponse]
        | Response[_CodedErrorResponse]
        | Response[_ModelValidationErrorResponse]
    ):
        """
        Create an org auth token for an organization, for tools such as CI pipelines.

        The response includes the full token in `token`. This is the only time the token is
        returned: store it securely, because it can't be retrieved again.

        Org auth tokens aren't tied to a member and keep working after the member who
        created them leaves the organization, so they can only be granted `org:ci`. Every new
        token is recorded in the organization's audit log, and every organization owner is
        emailed about it. Sending the same request again creates another token.

        Org auth tokens can be managed from a signed-in session, or with an OAuth application
        token that has the `org:tokens` scope in addition to one of the scopes listed here.
        An OAuth application token can only create a token with scopes that it holds itself;
        otherwise the request gets a 403. Personal auth tokens, org auth tokens and
        integration tokens can't call this endpoint and get a 403.
        """
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
            return Response(as_validation_errors(serializer), status=400)
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
        serialized_token: OrgAuthTokenSerializerResponse | None = serialize(
            token, request.user, token=token_str
        )

        if serialized_token is None:
            return Response({"detail": "Error when serializing token."}, status=400)

        return Response(serialized_token, status=status.HTTP_201_CREATED)
