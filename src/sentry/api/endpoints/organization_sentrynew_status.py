from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint


@region_silo_endpoint
class OrganizationSentryNewStatusEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ENTERPRISE
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization) -> Response:
        """
        Check if this is a SentryNew organization and return its status.
        This endpoint delegates to a getsentry-side service to avoid
        cross-DB queries and silo violations.
        """
        try:
            # Import the status service from getsentry; available in monorepo/runtime
            from getsentry.services.sentrynew_status import get_status_by_organization_id

            status_payload = get_status_by_organization_id(organization.id)
            return Response(status_payload)
        except Exception:
            # On failure, return a safe default (not SentryNew)
            return Response(
                {
                    "isSentryNew": False,
                    "isClaimed": False,
                    "isExpired": False,
                    "expiresAt": None,
                }
            )
