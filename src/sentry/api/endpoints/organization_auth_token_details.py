from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrgAuthTokenPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.orgauthtoken import MAX_NAME_LENGTH, OrgAuthToken
from sentry.organizations.services.organization.model import (
    RpcOrganization,
    RpcUserOrganizationContext,
)


@control_silo_endpoint
class OrganizationAuthTokenDetailsEndpoint(ControlSiloOrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (OrgAuthTokenPermission,)

    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
        token_id: int,
    ) -> Response:
        try:
            instance = OrgAuthToken.objects.get(
                organization_id=organization.id, date_deactivated__isnull=True, id=token_id
            )
        except OrgAuthToken.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(serialize(instance, request.user, token=None))

    def put(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
        token_id: int,
    ):
        try:
            instance = OrgAuthToken.objects.get(
                organization_id=organization.id, id=token_id, date_deactivated__isnull=True
            )
        except OrgAuthToken.DoesNotExist:
            raise ResourceDoesNotExist

        name = request.data.get("name")

        if not name:
            return Response({"detail": "The name cannot be blank."}, status=400)

        if len(name) > MAX_NAME_LENGTH:
            return Response(
                {"detail": "The name cannot be longer than 255 characters."}, status=400
            )

        instance.update(name=name)

        return Response(status=204)

    def delete(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
        token_id: int,
    ):
        try:
            instance = OrgAuthToken.objects.get(
                organization_id=organization.id, id=token_id, date_deactivated__isnull=True
            )
        except OrgAuthToken.DoesNotExist:
            raise ResourceDoesNotExist

        instance.update(date_deactivated=timezone.now())

        self.create_audit_entry(
            request,
            organization=organization,
            target_object=instance.id,
            event=audit_log.get_event_id("ORGAUTHTOKEN_REMOVE"),
            data=instance.get_audit_log_data(),
        )

        analytics.record(
            "org_auth_token.deleted",
            user_id=request.user.id,
            organization_id=organization.id,
        )

        return Response(status=204)
