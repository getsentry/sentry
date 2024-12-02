from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.userrollback import UserRollbackSerializer
from sentry.constants import ROLLBACK_ENABLED_DEFAULT
from sentry.models.organization import Organization
from sentry.models.rollbackorganization import RollbackOrganization
from sentry.models.rollbackuser import RollbackUser


@region_silo_endpoint
class OrganizationRollbackUserEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    def get(self, request: Request, organization: Organization) -> Response:
        """
        Retrieve an organiztion member's rollback
        """
        # Validate that the user/org has access to the feature
        if not features.has("organizations:sentry-rollback-2024", organization, actor=request.user):
            return Response(status=status.HTTP_404_NOT_FOUND)

        # Validate that the organization has rollbacks enabled
        if not organization.get_option("sentry:rollback_enabled", ROLLBACK_ENABLED_DEFAULT):
            return Response(
                status=status.HTTP_404_NOT_FOUND,
                data={
                    "detail": "Rollbacks are disabled for this organization.",
                    "code": "disabled",
                },
            )

        try:
            rollback_user = RollbackUser.objects.get(
                user_id=request.user.id, organization=organization
            )
        except RollbackUser.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        try:
            rollback_org = RollbackOrganization.objects.get(organization=organization)
        except RollbackOrganization.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(
            status=status.HTTP_200_OK,
            data=serialize(
                rollback_user,
                rollback_org=rollback_org,
                user=request.user,
                serializer=UserRollbackSerializer(),
            ),
        )
