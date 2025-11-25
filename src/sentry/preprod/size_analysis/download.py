from __future__ import annotations

import logging
from collections.abc import Sequence

from django.http.response import FileResponse, HttpResponseBase
from rest_framework.response import Response

from sentry.models.files.file import File
from sentry.preprod.models import PreprodArtifactSizeMetrics

logger = logging.getLogger(__name__)


class SizeAnalysisError(Exception):
    def __init__(self, message: str, status_code: int):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class SizeAnalysisMultipleResultsError(SizeAnalysisError):
    def __init__(self, message: str = "Multiple size analysis results found for this artifact"):
        super().__init__(message, 409)


class SizeAnalysisInternalError(SizeAnalysisError):
    def __init__(
        self, message: str = "An internal error occurred while retrieving size analysis results"
    ):
        super().__init__(message, 500)


class SizeAnalysisNotFoundError(SizeAnalysisError):
    def __init__(self, message: str = "Size analysis not found"):
        super().__init__(message, 404)


class SizeAnalysisFileNotFoundError(SizeAnalysisError):
    def __init__(self, message: str = "Analysis file not found"):
        super().__init__(message, 404)


class SizeAnalysisResultsUnavailableError(SizeAnalysisError):
    def __init__(self, message: str = "Size analysis completed but results are unavailable"):
        super().__init__(message, 500)


def get_size_analysis_response(
    all_size_metrics: Sequence[PreprodArtifactSizeMetrics],
) -> HttpResponseBase:
    """
    Get the appropriate response for size analysis results based on the state of the metrics.

    Returns:
        - 200 with message for PENDING/PROCESSING states
        - 422 with error details for FAILED state
        - 500 if COMPLETED but no analysis_file_id
        - 404 if COMPLETED but File object doesn't exist
        - 200 with file content for COMPLETED with valid file
    """
    states = [m.state for m in all_size_metrics]

    # Handle PENDING state
    if any(s == PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING for s in states):
        return Response(
            {"state": "pending", "message": "Size analysis is still processing"},
            status=200,
        )

    # Handle PROCESSING state
    if any(s == PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING for s in states):
        return Response(
            {"state": "processing", "message": "Size analysis is still processing"},
            status=200,
        )

    # Handle FAILED state
    if any(s == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED for s in states):
        failed_metric = next(
            m
            for m in all_size_metrics
            if m.state == PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED
        )
        return Response(
            {
                "state": "failed",
                "error_code": failed_metric.error_code,
                "error_message": failed_metric.error_message or "Size analysis failed",
            },
            status=422,
        )

    # All metrics are COMPLETED - need to return file content
    analysis_file_ids = [m.analysis_file_id for m in all_size_metrics if m.analysis_file_id]

    if not analysis_file_ids:
        raise SizeAnalysisResultsUnavailableError()

    analysis_file_id = analysis_file_ids[0]
    try:
        file_obj = File.objects.get(id=analysis_file_id)
    except File.DoesNotExist:
        logger.warning(
            "Analysis file not found for size metrics",
            extra={"analysis_file_id": analysis_file_id},
        )
        raise SizeAnalysisFileNotFoundError()

    try:
        fp = file_obj.getfile()
    except Exception as e:
        logger.exception("Uncaught error getting size analysis file", extra={"error": e})
        raise SizeAnalysisInternalError()

    response = FileResponse(
        fp,
        content_type="application/json",
    )
    response["Content-Length"] = file_obj.size
    return response


def get_size_analysis_file_response(size_metrics: PreprodArtifactSizeMetrics) -> FileResponse:
    """
    Get the file response for a single size metrics record.
    This is a legacy function for backwards compatibility.
    """
    try:
        file_obj = File.objects.get(id=size_metrics.analysis_file_id)
    except File.DoesNotExist:
        raise SizeAnalysisNotFoundError()

    try:
        fp = file_obj.getfile()
    except Exception as e:
        logger.exception("Uncaught error getting size analysis file", extra={"error": e})
        raise SizeAnalysisInternalError()

    response = FileResponse(
        fp,
        content_type="application/json",
    )
    response["Content-Length"] = file_obj.size
    return response


def get_size_analysis_error_response(error: SizeAnalysisError) -> Response:
    return Response({"error": error.message}, status=error.status_code)
