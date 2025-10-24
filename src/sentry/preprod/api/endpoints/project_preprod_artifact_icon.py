from __future__ import annotations

import logging

from django.http import HttpResponse
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.objectstore import app_icons
from sentry.objectstore.service import ClientError

logger = logging.getLogger(__name__)


def detect_image_content_type(image_data: bytes) -> str:
    """
    Detect the content type of an image from its magic bytes.
    Returns the appropriate MIME type or a default if unknown.
    """
    if not image_data:
        return "application/octet-stream"

    # Check magic bytes for common image formats
    if image_data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    elif image_data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    elif image_data[:4] == b"RIFF" and image_data[8:12] == b"WEBP":
        return "image/webp"
    elif image_data[:2] in (b"BM", b"BA", b"CI", b"CP", b"IC", b"PT"):
        return "image/bmp"
    elif image_data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    elif image_data[:4] == b"\x00\x00\x01\x00":
        return "image/x-icon"
    elif len(image_data) >= 12 and image_data[4:12] in (b"ftypavif", b"ftypavis"):
        return "image/avif"
    elif len(image_data) >= 12 and image_data[4:12] in (
        b"ftypheic",
        b"ftypheix",
        b"ftyphevc",
        b"ftyphevx",
    ):
        return "image/heic"

    # Default to generic binary if we can't detect the type
    logger.warning(
        "Could not detect image content type from magic bytes",
        extra={"first_bytes": image_data[:16].hex() if len(image_data) >= 16 else image_data.hex()},
    )
    return "application/octet-stream"


@region_silo_endpoint
class ProjectPreprodArtifactIconEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        request: Request,
        project: Project,
        app_icon_id: str,
    ) -> HttpResponse:
        organization_id = project.organization_id
        project_id = project.id

        # object_key = f"{organization_id}/{project_id}/{app_icon_id}"
        logger.info(
            "Retrieving app icon from objectstore",
            extra={
                "organization_id": organization_id,
                "project_id": project_id,
                "app_icon_id": app_icon_id,
            },
        )
        client = app_icons.for_project(organization_id, project_id)

        try:
            result = client.get(app_icon_id)
            # Read the entire stream at once
            image_data = result.payload.read()

            # Detect content type from the image data
            content_type = detect_image_content_type(image_data)

            logger.info(
                "Retrieved app icon from objectstore",
                extra={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "app_icon_id": app_icon_id,
                    "size_bytes": len(image_data),
                    "content_type": content_type,
                },
            )
            return HttpResponse(image_data, content_type=content_type)

        except ClientError as e:
            if e.status == 404:
                logger.warning(
                    "App icon not found in objectstore",
                    extra={
                        "organization_id": organization_id,
                        "project_id": project_id,
                        "app_icon_id": app_icon_id,
                    },
                )

                # Upload failed, return appropriate error
                return HttpResponse({"error": "Not found"}, status=404)

            logger.warning(
                "Failed to retrieve app icon from objectstore",
                extra={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "app_icon_id": app_icon_id,
                    "error": str(e),
                    "status": e.status,
                },
            )
            return HttpResponse({"error": "Failed to retrieve app icon"}, status=500)

        except Exception:
            logger.exception(
                "Unexpected error retrieving app icon",
                extra={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "app_icon_id": app_icon_id,
                },
            )
            return HttpResponse({"error": "Internal server error"}, status=500)
