from __future__ import annotations

import logging
import uuid
from typing import Any

import requests
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.replays.lib.storage import make_filename
from sentry.replays.usecases.reader import fetch_direct_storage_segments_meta
from sentry.utils.cursors import Cursor, CursorResult

REFERRER = "replays.query.query_replay_clicks_dataset"

logger = logging.getLogger()


@region_silo_endpoint
class ProjectReplayAccessibilityIssuesEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(self, request: Request, project: Project, replay_id: str) -> Response:
        if not features.has(
            "organizations:session-replay", project.organization, actor=request.user
        ):
            return Response(status=404)

        if not features.has(
            "organizations:session-replay-accessibility-issues",
            project.organization,
            actor=request.user,
        ):
            return Response(status=404)

        try:
            replay_id = str(uuid.UUID(replay_id))
        except ValueError:
            return Response(status=404)

        def data_fn(offset, limit):
            # We only support direct-storage.  Filestore is deprecated and should be removed from
            # the driver.
            segments = fetch_direct_storage_segments_meta(project.id, replay_id, offset, limit)

            # Make a POST request to the replay-analyzer service. The files will be downloaded
            # and evaluated on the remote system. The accessibility output is then redirected to
            # the client.
            return request_accessibility_issues([make_filename(segment) for segment in segments])

        return self.paginate(
            request=request,
            paginator=ReplayAccessibilityPaginator(data_fn=data_fn),
        )


class ReplayAccessibilityPaginator:
    """Replay Analyzer service paginator class."""

    def __init__(self, data_fn):
        self.data_fn = data_fn

    def get_result(self, limit, cursor=None):
        offset = cursor.offset if cursor is not None else 0

        data = self.data_fn(offset=offset, limit=limit)

        return CursorResult(
            data,
            hits=data["meta"]["total"],
            prev=Cursor(0, max(0, offset - limit), True, offset > 0),
            next=Cursor(0, max(0, offset + limit), False, False),
        )


def request_accessibility_issues(filenames: list[str]) -> Any:
    try:
        return requests.post(
            f"{options.get('replay.analyzer_service_url')}/api/0/analyze/accessibility",
            json={"data": {"filenames": filenames}},
        ).json()
    except Exception:
        logger.exception("replay accessibility analysis failed")
        raise ParseError("Could not analyze accessibility issues at this time.")
