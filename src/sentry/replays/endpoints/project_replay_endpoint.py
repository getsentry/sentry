from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request

from sentry import features
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.replays.permissions import has_replay_permission


class ProjectReplayEndpoint(ProjectEndpoint):
    """
    Base endpoint for replay-related project endpoints.
    Provides centralized feature and permission checks for session replay access.
    Added to ensure that all replay endpoints are consistent and follow the same pattern
    for allowing granular user-based replay access control, in addition to the existing
    role-based access control and feature flag-based access control.
    """

    def check_replay_access(self, request: Request, project: Project) -> None:
        """
        Check if the session replay feature is enabled and user has replay permissions.
        Raises NotFound if feature is disabled, PermissionDenied if user lacks access.
        """
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            raise NotFound()

        if not has_replay_permission(request, project.organization):
            raise PermissionDenied()
