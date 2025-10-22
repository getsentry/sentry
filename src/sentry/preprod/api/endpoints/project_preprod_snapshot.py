from __future__ import annotations

import logging
import os

from django.http import HttpResponse
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.objectstore import snapshots
from sentry.objectstore.service import ClientError

logger = logging.getLogger(__name__)


def _upload_test_snapshot(
    client: object,
    object_key: str,
    organization_id: int,
    project_id: int,
    image_hash: str,
) -> tuple[bytes | None, str | None]:
    """
    Upload test.png from desktop to objectstore.

    Returns:
        tuple: (image_data, error_message)
            - If successful: (image_data, None)
            - If failed: (None, error_message)
    """
    test_png_path = os.path.expanduser("~/Desktop/test.png")

    if not os.path.exists(test_png_path):
        logger.warning(
            "Snapshot not found and test.png does not exist on desktop",
            extra={
                "organization_id": organization_id,
                "project_id": project_id,
                "image_hash": image_hash,
                "object_key": object_key,
                "test_png_path": test_png_path,
            },
        )
        return None, "Snapshot not found and no test file available"

    try:
        with open(test_png_path, "rb") as f:
            test_image_data = f.read()

        logger.info(
            "Uploading test snapshot to objectstore",
            extra={
                "organization_id": organization_id,
                "project_id": project_id,
                "image_hash": image_hash,
                "object_key": object_key,
                "file_size": len(test_image_data),
            },
        )

        client.put(test_image_data, id=object_key, compression="none")

        return test_image_data, None

    except Exception as upload_error:
        logger.exception(
            "Failed to upload test snapshot",
            extra={
                "organization_id": organization_id,
                "project_id": project_id,
                "image_hash": image_hash,
                "object_key": object_key,
                "error": str(upload_error),
            },
        )
        return None, "Failed to upload test snapshot"


@region_silo_endpoint
class ProjectPreprodSnapshotEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        request: Request,
        project: Project,
        image_hash: str,
    ) -> HttpResponseBase:
        organization_id = project.organization_id
        project_id = project.id

        object_key = f"{organization_id}/{project_id}/{image_hash}"
        client = snapshots.for_project(organization_id, project_id)

        try:
            result = client.get(object_key)
            image_data = result.payload.read()
            response = HttpResponse(image_data, content_type="image/png")
            return response

        except ClientError as e:
            if e.status == 404:
                # Uncomment this to upload test image on first 404
                # image_data, error = _upload_test_snapshot(
                #     client, object_key, organization_id, project_id, image_hash
                # )

                # Upload failed, return appropriate error
                return HttpResponse({"error": "Not found"}, status=404)

            logger.warning(
                "Failed to retrieve snapshot from objectstore",
                extra={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "image_hash": image_hash,
                    "object_key": object_key,
                    "error": str(e),
                    "status": e.status,
                },
            )
            return HttpResponse({"error": "Failed to retrieve snapshot"}, status=500)

        except Exception:
            logger.exception(
                "Unexpected error retrieving snapshot",
                extra={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "image_hash": image_hash,
                    "object_key": object_key,
                },
            )
            return HttpResponse({"error": "Internal server error"}, status=500)
