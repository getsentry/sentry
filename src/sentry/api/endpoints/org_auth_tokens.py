from datetime import datetime

from django.core.exceptions import ValidationError
from django.db.models import Value
from django.db.models.functions import Coalesce
from django.views.decorators.cache import never_cache
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrgAuthTokenPermission
from sentry.api.serializers import serialize
from sentry.api.utils import generate_region_url
from sentry.models.organization import Organization
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.utils import hashlib
from sentry.utils.security.orgauthtoken_jwt import generate_token


@control_silo_endpoint
class OrgAuthTokensEndpoint(OrganizationEndpoint):
    permission_classes = (OrgAuthTokenPermission,)

    @never_cache
    def get(self, request: Request, organization: Organization) -> Response:
        # We want to sort by date_last_used, but sort NULLs last
        the_past = datetime.min

        token_list = list(
            OrgAuthToken.objects.filter(
                organization_id=organization.id, date_deactivated__isnull=True
            )
            .annotate(last_used_non_null=Coalesce("date_last_used", Value(the_past)))
            .order_by("-last_used_non_null", "name", "-date_added")
        )

        return Response(serialize(token_list, request.user, token=None))

    def post(self, request: Request, organization: Organization) -> Response:
        jwt_token = generate_token(organization.slug, generate_region_url())
        token_hashed = hashlib.sha256_text(jwt_token).hexdigest()

        name = request.data.get("name")

        # Main validation cases with specific error messages
        if not name:
            return Response({"detail": ["The name cannot be blank."]}, status=400)

        token = OrgAuthToken.objects.create(
            name=name,
            organization_id=organization.id,
            # TODO FN: This will eventually be org:ci
            scope_list=["org:read"],
            created_by_id=request.user.id,
            token_last_characters=jwt_token[-4:],
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

        analytics.record(
            "org_auth_token.created",
            user_id=request.user.id,
            organization_id=organization.id,
        )

        # This is THE ONLY TIME that the token is available
        serialized_token = serialize(token, request.user, token=jwt_token)

        if serialized_token is None:
            return Response({"detail": "Error when serializing token."}, status=400)

        return Response(serialized_token, status=status.HTTP_201_CREATED)
