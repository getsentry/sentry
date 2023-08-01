from rest_framework.request import Request
from rest_framework.response import Response

from sentry import ratelimits as ratelimiter
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import Organization
from sentry.models.group import Group
from sentry.models.projectownership import ProjectOwnership
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class OrganizationForceAutoAssignmentEndpoint(OrganizationEndpoint):

    rate_limits = {"PUT": {RateLimitCategory.ORGANIZATION: RateLimit(1, 60)}}  # 1 rpm

    def put(self, request: Request, organization: Organization) -> Response:
        """
        Endpoint for forcing autoassignment to run for specified group ids.
        This is for if a user incorrectly manually assigns a group and wants autoassignment to run.
        """
        if ratelimiter.is_limited(  # type: ignore [attr-defined]
            key=f"org-force-autoassignment:{organization.id}",
            limit=1,
            window=60,
        ):
            return Response(
                {"detail": "Rate limit of 1 request per org per minute exceeded."}, status=429
            )

        group_ids = request.data.get("group_ids")
        if group_ids and len(group_ids) > 100:
            return Response(
                {"detail": "Too many group ids. Number of group ids should be <= 100."}, status=431
            )

        if group_ids:
            group_ids = [int(group_id) for group_id in group_ids]
            groups = Group.objects.filter(id__in=group_ids)

            for group in groups:
                ProjectOwnership.handle_auto_assignment(project_id=group.project.id, group=group)
            return Response(serialize(group_ids), status=200)

        return Response({"detail": "Request must include group ids."}, status=400)
