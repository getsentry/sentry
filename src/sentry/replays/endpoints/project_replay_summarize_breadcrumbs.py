import functools
import time
from collections.abc import Generator, Iterator
from typing import Any

import requests
import sentry_sdk
from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import GenericOffsetPaginator
from sentry.replays.lib.storage import RecordingSegmentStorageMeta, storage
from sentry.replays.usecases.ingest.event_parser import as_log_message
from sentry.replays.usecases.reader import fetch_segments_metadata, iter_segment_data
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json


@region_silo_endpoint
@extend_schema(tags=["Replays"])
class ProjectReplaySummarizeBreadcrumbsEndpoint(ProjectEndpoint):
    owner = ApiOwner.REPLAY
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def __init__(self, **options) -> None:
        storage.initialize_client()
        super().__init__(**options)

    def get(self, request: Request, project, replay_id: str) -> Response:
        """Return a collection of replay recording segments."""
        if (
            not features.has(
                "organizations:session-replay", project.organization, actor=request.user
            )
            or not features.has(
                "organizations:replay-ai-summaries", project.organization, actor=request.user
            )
            or not features.has(
                "organizations:gen-ai-features", project.organization, actor=request.user
            )
        ):
            return self.respond(status=404)

        return self.paginate(
            request=request,
            paginator_cls=GenericOffsetPaginator,
            data_fn=functools.partial(fetch_segments_metadata, project.id, replay_id),
            on_results=analyze_recording_segments,
        )


@sentry_sdk.trace
def analyze_recording_segments(segments: list[RecordingSegmentStorageMeta]) -> dict[str, Any]:
    with sentry_sdk.configure_scope() as scope:
        scope.set_tag("replay.segments_count", len(segments))

    start_time = time.time()

    try:
        # Get request data and measure its size
        request_logs = list(get_request_data(iter_segment_data(segments)))
        request_data = json.dumps({"logs": request_logs})

        with sentry_sdk.configure_scope() as scope:
            scope.set_tag("replay.request_data_size", len(request_data))
            scope.set_tag("replay.logs_count", len(request_logs))

        sentry_sdk.add_breadcrumb(
            message="Starting Seer request for replay breadcrumb summarization",
            level="info",
            data={
                "segments_count": len(segments),
                "request_data_size_bytes": len(request_data),
                "logs_count": len(request_logs),
            }
        )

        # Make the Seer request
        response_content = make_seer_request(request_data)

        # Parse the response
        try:
            result = json.loads(response_content.decode("utf-8"))

            elapsed_time = time.time() - start_time
            sentry_sdk.add_breadcrumb(
                message="Successfully completed Seer request and JSON parsing",
                level="info",
                data={
                    "response_size_bytes": len(response_content),
                    "elapsed_time_seconds": elapsed_time,
                }
            )

            return result

        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            sentry_sdk.add_breadcrumb(
                message="Failed to decode Seer response",
                level="error",
                data={
                    "error": str(e),
                    "response_size_bytes": len(response_content),
                    "response_preview": response_content[:500].decode("utf-8", errors="replace") if response_content else None,
                }
            )
            sentry_sdk.capture_exception(e)
            raise ParseError("Failed to parse Seer response") from e

    except Exception as e:
        elapsed_time = time.time() - start_time
        sentry_sdk.add_breadcrumb(
            message="Failed during replay summarization",
            level="error",
            data={
                "error": str(e),
                "error_type": type(e).__name__,
                "elapsed_time_seconds": elapsed_time,
            }
        )
        raise


def make_seer_request(request_data: str) -> bytes:
    start_time = time.time()
    url = f"{settings.SEER_AUTOFIX_URL}/v1/automation/summarize/replay/breadcrumbs"

    # Log request details
    sentry_sdk.add_breadcrumb(
        message="Initiating Seer API request",
        level="info",
        data={
            "url": url,
            "request_size_bytes": len(request_data),
            "has_seer_url": bool(settings.SEER_AUTOFIX_URL),
        }
    )

    try:
        # XXX: Request isn't streaming. Limitation of Seer authentication. Would be much faster if we
        # could stream the request data since the GCS download will (likely) dominate latency.
        headers = {
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(request_data.encode()),
        }

        response = requests.post(
            url,
            data=request_data,
            headers=headers,
            timeout=30,  # Add explicit timeout for debugging
        )

        elapsed_time = time.time() - start_time

        # Log response details
        sentry_sdk.add_breadcrumb(
            message="Received Seer API response",
            level="info",
            data={
                "status_code": response.status_code,
                "response_size_bytes": len(response.content) if response.content else 0,
                "elapsed_time_seconds": elapsed_time,
                "response_headers": dict(response.headers),
                "request_id": response.headers.get("x-request-id"),
            }
        )

        # Check status code and provide detailed error info
        if response.status_code != 200:
            error_data = {
                "status_code": response.status_code,
                "response_headers": dict(response.headers),
                "response_text": response.text[:1000] if response.text else None,  # First 1000 chars
                "request_url": url,
                "elapsed_time_seconds": elapsed_time,
            }

            sentry_sdk.add_breadcrumb(
                message="Seer API returned non-200 status code",
                level="error",
                data=error_data
            )

            # Add extra context to the scope
            with sentry_sdk.configure_scope() as scope:
                scope.set_tag("seer.status_code", response.status_code)
                scope.set_context("seer_response", error_data)

            # Capture this as an exception for better visibility
            sentry_sdk.capture_message(
                f"Seer API returned status {response.status_code}: {response.text[:500]}",
                level="error"
            )

            raise ParseError("A summary could not be produced at this time.")

        return response.content

    except requests.exceptions.RequestException as e:
        elapsed_time = time.time() - start_time

        error_data = {
            "error": str(e),
            "error_type": type(e).__name__,
            "url": url,
            "elapsed_time_seconds": elapsed_time,
        }

        sentry_sdk.add_breadcrumb(
            message="Seer API request failed with network error",
            level="error",
            data=error_data
        )

        with sentry_sdk.configure_scope() as scope:
            scope.set_context("seer_request_error", error_data)

        sentry_sdk.capture_exception(e)
        raise ParseError("A summary could not be produced at this time.") from e

    except Exception as e:
        elapsed_time = time.time() - start_time

        sentry_sdk.add_breadcrumb(
            message="Unexpected error during Seer API request",
            level="error",
            data={
                "error": str(e),
                "error_type": type(e).__name__,
                "elapsed_time_seconds": elapsed_time,
            }
        )

        sentry_sdk.capture_exception(e)
        raise ParseError("A summary could not be produced at this time.") from e


def get_request_data(iterator: Iterator[tuple[int, memoryview]]) -> list[str]:
    return list(gen_request_data(map(lambda r: r[1], iterator)))


def gen_request_data(segments: Iterator[memoryview]) -> Generator[str]:
    for segment in segments:
        for event in json.loads(segment.tobytes().decode("utf-8")):
            message = as_log_message(event)
            if message:
                yield message
