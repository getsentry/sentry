from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.endpoints.organization_member.index import MemberPermission
from sentry.services.hybrid_cloud.user.service import user_service


@region_silo_endpoint
class OrganizationUserDetailsEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }
    permission_classes = (MemberPermission,)

    def get(self, request: Request, organization, user_id) -> Response:
        try:
            int(user_id)
        except ValueError:
            raise ValidationError(f"user_id({user_id}) must be an integer")

        users = user_service.serialize_many(
            filter={"user_ids": [user_id], "organization_id": organization.id}, as_user=request.user
        )
        if len(users) == 0:
            return Response(status=404)

        return Response(users[0])
