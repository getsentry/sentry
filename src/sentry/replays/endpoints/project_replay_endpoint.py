from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.replays.permissions import has_replay_permission


class ProjectReplayEndpoint(ProjectEndpoint):
    """
    Base endpoint for replay-related endpoints.
    Provides centralized feature and permission checks for session replay access.
    Added to ensure that all replay endpoints are consistent and follow the same pattern
    for allowing granular user-based replay access control, in addition to the existing
    role-based access control and feature flag-based access control.
    """

    def check_replay_access(self, request: Request, project: Project) -> Response | None:
        """
        Check if the session replay feature is enabled and user has replay permissions.
        Returns a Response object if access should be denied, None if access is granted.
        """
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        if not has_replay_permission(project.organization, request.user):
            return Response(status=403)

        return None
