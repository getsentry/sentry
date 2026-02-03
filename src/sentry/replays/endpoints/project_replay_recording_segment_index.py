import functools
from typing import Any

from django.http import StreamingHttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.replay_examples import ReplayExamples
from sentry.apidocs.parameters import CursorQueryParam, GlobalParams, ReplayParams, VisibilityParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.replays.endpoints.project_replay_endpoint import ProjectReplayEndpoint
from sentry.replays.lib.storage import storage
from sentry.replays.usecases.reader import download_segments, fetch_segments_metadata


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplayRecordingSegmentIndexEndpoint(ProjectReplayEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }

    def __init__(self, **options) -> None:
        storage.initialize_client()
        super().__init__(**options)

    @extend_schema(
        operation_id="List Recording Segments",
        parameters=[
            CursorQueryParam,
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            ReplayParams.REPLAY_ID,
            VisibilityParams.PER_PAGE,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListReplayRecordingSegments", list[list[dict[str, Any]]]
            ),
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=ReplayExamples.GET_REPLAY_SEGMENTS,
    )
    def get(self, request: Request, project, replay_id: str) -> Response:
        """Return a collection of replay recording segments."""
        self.check_replay_access(request, project)

        return self.paginate(
            request=request,
            response_cls=StreamingHttpResponse,
            response_kwargs={"content_type": "application/json"},
            paginator_cls=GenericOffsetPaginator,
            data_fn=functools.partial(fetch_segments_metadata, project.id, replay_id),
            on_results=download_segments,
        )
