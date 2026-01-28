from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.apidocs.constants import (
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams, UptimeParams
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.uptime.endpoints.bases import ProjectUptimeAlertEndpoint
from sentry.uptime.models import (
    RESPONSE_BODY_SEPARATOR,
    UptimeResponseCapture,
    get_uptime_subscription,
)
from sentry.workflow_engine.models import Detector


def parse_response_content(content: bytes) -> tuple[list[list[str]], bytes]:
    """
    Parse the stored response content into headers and body.

    The format is: headers (one per line), separator, body
    """
    if RESPONSE_BODY_SEPARATOR in content:
        header_bytes, body = content.split(RESPONSE_BODY_SEPARATOR, 1)
    else:
        header_bytes = content
        body = b""

    headers: list[list[str]] = []
    if header_bytes:
        for line in header_bytes.decode("utf-8", errors="replace").split("\r\n"):
            if ": " in line:
                name, value = line.split(": ", 1)
                headers.append([name, value])

    return headers, body


@region_silo_endpoint
class ProjectUptimeResponseCaptureEndpoint(ProjectUptimeAlertEndpoint):
    owner = ApiOwner.CRONS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
    }

    @extend_schema(
        operation_id="Retrieve an Uptime Response Capture",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            UptimeParams.UPTIME_ALERT_ID,
        ],
        responses={
            200: dict,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        project: Project,
        uptime_detector: Detector,
        capture_id: str,
    ) -> Response:
        """
        Retrieve the HTTP response captured during an uptime check failure.
        """
        uptime_subscription = get_uptime_subscription(uptime_detector)

        try:
            capture = UptimeResponseCapture.objects.get(
                id=capture_id,
                uptime_subscription=uptime_subscription,
            )
        except (UptimeResponseCapture.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        try:
            file = File.objects.get(pk=capture.file_id)
            content = file.getfile().read()
        except File.DoesNotExist:
            raise ResourceDoesNotExist

        headers, body = parse_response_content(content)

        return Response(
            {
                "id": str(capture.id),
                "headers": headers,
                "body": body.decode("utf-8", errors="replace"),
                "bodySize": len(body),
            }
        )

    @extend_schema(
        operation_id="Delete an Uptime Response Capture",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            UptimeParams.UPTIME_ALERT_ID,
        ],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self,
        request: Request,
        project: Project,
        uptime_detector: Detector,
        capture_id: str,
    ) -> Response:
        """
        Delete a captured HTTP response from an uptime check failure.
        """
        uptime_subscription = get_uptime_subscription(uptime_detector)

        try:
            capture = UptimeResponseCapture.objects.get(
                id=capture_id,
                uptime_subscription=uptime_subscription,
            )
        except (UptimeResponseCapture.DoesNotExist, ValueError):
            raise ResourceDoesNotExist

        capture.delete()

        return Response(status=204)
