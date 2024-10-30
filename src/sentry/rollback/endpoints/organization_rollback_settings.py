from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.organization import Organization


@region_silo_endpoint
class OrganizationRollbackSettingsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    scope_map = {
        "GET": ["org:read", "org:admin"],
        "PUT": ["org:admin"],
    }

    def get(self, request: Request, organization: Organization) -> Response:
        rollback_enabled = organization.get_option("sentry:rollback_enabled")
        rollback_sharing_enabled = organization.get_option("sentry:rollback_sharing_enabled")

        if rollback_enabled is None and rollback_sharing_enabled is None:
            organization.update_option("sentry:rollback_enabled", True)
            organization.update_option("sentry:rollback_sharing_enabled", True)
            rollback_enabled, rollback_sharing_enabled = True, True

        return Response(
            status=200,
            data={
                "rollbackEnabled": rollback_enabled,
                "rollbackSharingEnabled": rollback_sharing_enabled,
            },
        )

    def put(self, request: Request, organization: Organization) -> Response:
        rollback_enabled = request.data.get("rollbackEnabled")
        rollback_sharing_enabled = request.data.get("rollbackSharingEnabled")

        if rollback_enabled is None and rollback_sharing_enabled is None:
            return Response(
                {"detail": "Must specify at least one setting"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if (rollback_enabled is not None and not isinstance(rollback_enabled, bool)) or (
            rollback_sharing_enabled is not None and not isinstance(rollback_sharing_enabled, bool)
        ):
            return Response(
                {"detail": "Settings values must be a boolean"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if rollback_enabled is not None:
            organization.update_option(key="sentry:rollback_enabled", value=rollback_enabled)

        if rollback_sharing_enabled is not None:
            organization.update_option(
                key="sentry:rollback_sharing_enabled", value=rollback_sharing_enabled
            )

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=organization.id,
            event=audit_log.get_event_id("ORG_EDIT"),
            data={
                "rollbackEnabled": rollback_enabled,
                "rollbackSharingEnabled": rollback_sharing_enabled,
            },
        )

        return Response(status=status.HTTP_204_NO_CONTENT)
