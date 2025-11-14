from typing import int
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, audit_log
from sentry.analytics.events.org_auth_token_deleted import OrgAuthTokenDeleted
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import SessionNoAuthTokenAuthentication
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import ControlSiloOrganizationEndpoint, OrgAuthTokenPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.orgauthtoken import MAX_NAME_LENGTH, OrgAuthToken
from sentry.organizations.services.organization.model import RpcOrganization


@control_silo_endpoint
class OrganizationAuthTokenDetailsEndpoint(ControlSiloOrganizationEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE
    authentication_classes = (SessionNoAuthTokenAuthentication,)
    permission_classes = (OrgAuthTokenPermission,)

    def convert_args(self, request: Request, token_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        organization = kwargs["organization"]
        try:
            kwargs["instance"] = OrgAuthToken.objects.get(
                organization_id=organization.id, id=token_id, date_deactivated__isnull=True
            )
        except OrgAuthToken.DoesNotExist:
            raise ResourceDoesNotExist

        return (args, kwargs)

    def get(
        self,
        request: Request,
        instance: OrgAuthToken,
        **kwargs,
    ) -> Response:
        return Response(serialize(instance, request.user, token=None))

    def put(
        self,
        request: Request,
        instance: OrgAuthToken,
        **kwargs,
    ):
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
        organization: RpcOrganization,
        instance: OrgAuthToken,
        **kwargs,
    ):
        instance.update(date_deactivated=timezone.now())

        self.create_audit_entry(
            request,
            organization=organization,
            target_object=instance.id,
            event=audit_log.get_event_id("ORGAUTHTOKEN_REMOVE"),
            data=instance.get_audit_log_data(),
        )

        analytics.record(
            OrgAuthTokenDeleted(
                user_id=request.user.id,
                organization_id=organization.id,
            )
        )

        return Response(status=204)
