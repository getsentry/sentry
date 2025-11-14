from __future__ import annotations
from typing import int

import logging

from django.http.response import FileResponse
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


def get_size_analysis_file_response(size_metrics: PreprodArtifactSizeMetrics) -> FileResponse:
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
