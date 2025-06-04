from datetime import UTC, datetime

from django.core.exceptions import ValidationError
from django.db.models import Value
from django.db.models.functions import Coalesce
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log, roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrgAuthTokenPermission
from sentry.api.serializers import serialize
from sentry.api.utils import generate_region_url
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.models.orgauthtoken import MAX_NAME_LENGTH, OrgAuthToken
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)
from sentry.security.utils import capture_security_activity
from sentry.users.models.user import User
from sentry.utils.security.orgauthtoken_token import (
    SystemUrlPrefixMissingException,
    generate_token,
    hash_token,
)


@control_silo_endpoint
class OrganizationAuthTokensEndpoint(ControlSiloOrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (OrgAuthTokenPermission,)

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
                organization.slug, generate_region_url(region_name=org_mapping.region_name)
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

        name = request.data.get("name")

        # Main validation cases with specific error messages
        if not name:
            return Response({"detail": "The name cannot be blank."}, status=400)

        if len(name) > MAX_NAME_LENGTH:
            return Response(
                {"detail": "The name cannot be longer than 255 characters."}, status=400
            )

        token = OrgAuthToken.objects.create(
            name=name,
            organization_id=organization.id,
            scope_list=["org:ci"],
            created_by_id=request.user.id,
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
            data=token.get_audit_log_data(),
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
            "org_auth_token.created",
            user_id=request.user.id,
            organization_id=organization.id,
        )

        # This is THE ONLY TIME that the token is available
        serialized_token = serialize(token, request.user, token=token_str)

        if serialized_token is None:
            return Response({"detail": "Error when serializing token."}, status=400)

        return Response(serialized_token, status=status.HTTP_201_CREATED)
