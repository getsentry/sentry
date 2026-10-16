import uuid
from typing import Any

from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.request import Request

from sentry import features
from sentry.api.api_owners import ApiOwner
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

    owner = ApiOwner.DATA_BROWSING

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)

        replay_id = kwargs.get("replay_id")
        if replay_id is not None:
            # Validate only. Do not replace `replay_id` with a normalized form here, because
            # downstream consumers expect different formats:
            #
            # - Recording and video blob keys are built from the id as passed in
            #   (`_make_recording_filename`). Blobs are written with the dash-free 32-hex id,
            #   so converting to the dashed form would make segment and video lookups miss.
            # - Snuba queries need the dashed form. Handlers and `usecases/reader.py` convert
            #   with `str(uuid.UUID(replay_id))` right before querying.
            # - Seer (summaries) receives the id as passed in.
            #
            # Any normalization belongs next to the consumer that needs a specific format.
            try:
                uuid.UUID(replay_id)
            except ValueError:
                raise NotFound()

        return args, kwargs

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
