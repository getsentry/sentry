from typing import Any

from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log
from sentry.analytics.events.org_auth_token_deleted import OrgAuthTokenDeleted
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
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import DisallowImpersonatedTokenCreation
from sentry.api.serializers import serialize
from sentry.api.utils import to_valid_int_id
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NO_CONTENT, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.auth.principal import acting_user_id
from sentry.models.orgauthtoken import MAX_NAME_LENGTH, OrgAuthToken
from sentry.organizations.services.organization.model import RpcOrganization


@extend_schema(tags=["Organizations"])
@control_silo_endpoint
class OrganizationAuthTokenDetailsEndpoint(ControlSiloOrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    # Revoking an already revoked token returns 404, and each revocation is audit logged.
    idempotent_methods = frozenset()
    owner = ApiOwner.FOUNDATIONS
    authentication_classes = (SessionNoAuthTokenAuthentication, UserAuthTokenAuthentication)
    permission_classes = (OrgAuthTokenPermission, DisallowImpersonatedTokenCreation)

    def convert_args(
        self, request: Request, token_id: str, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]
        validated_token_id = to_valid_int_id("token_id", token_id, raise_404=True)
        try:
            kwargs["instance"] = OrgAuthToken.objects.get(
                organization_id=organization.id,
                id=validated_token_id,
                date_deactivated__isnull=True,
            )
        except OrgAuthToken.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def get(
        self,
        request: Request,
        organization: RpcOrganization,
        instance: OrgAuthToken,
        **kwargs: object,
    ) -> Response:
        return Response(serialize(instance, request.user, token=None))

    def put(
        self,
        request: Request,
        organization: RpcOrganization,
        instance: OrgAuthToken,
        **kwargs: object,
    ) -> Response:
        name = request.data.get("name")

        if not name:
            return Response({"detail": "The name cannot be blank."}, status=400)

        if len(name) > MAX_NAME_LENGTH:
            return Response(
                {"detail": "The name cannot be longer than 255 characters."}, status=400
            )

        instance.update(name=name)

        return Response(status=204)

    @extend_schema(
        operation_id="deleteOrganizationAuthToken",
        summary="Revoke an Org Auth Token",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="token_id",
                location="path",
                required=True,
                type=int,
                description="The ID of the org auth token to revoke.",
            ),
        ],
        request=None,
        responses={
            204: RESPONSE_NO_CONTENT,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self,
        request: Request,
        organization: RpcOrganization,
        instance: OrgAuthToken,
        **kwargs: object,
    ) -> Response[None]:
        """
        Revoke an organization's org auth token, so it can no longer authenticate requests.
        The revocation is recorded in the organization's audit log. Revoking a token that
        was already revoked returns 404.

        Org auth tokens can be managed from a signed-in session, or with an OAuth application
        token that has the `org:tokens` scope in addition to one of the scopes listed here.
        Personal auth tokens, org auth tokens and integration tokens can't call this endpoint
        and get a 403.
        """
        instance.update(date_deactivated=timezone.now())

        self.create_audit_entry(
            request,
            organization=organization,
            target_object=instance.id,
            event=audit_log.get_event_id("ORGAUTHTOKEN_REMOVE"),
            data={**instance.get_audit_log_data(), **get_issuing_token_audit_log_data(request)},
        )

        analytics.record(
            OrgAuthTokenDeleted(
                user_id=acting_user_id(request.user),
                organization_id=organization.id,
            )
        )

        return Response(status=204)
