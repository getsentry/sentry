from __future__ import annotations

import logging

from django.http import HttpResponse
from objectstore_client import ClientError
from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.objectstore import get_preprod_session

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectPreprodArtifactImageEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }

    def get(
        self,
        _: Request,
        project: Project,
        image_id: str,
    ) -> HttpResponse:

        organization_id = project.organization_id
        project_id = project.id

        object_key = f"{organization_id}/{project_id}/{image_id}"
        session = get_preprod_session(organization_id, project_id)

        try:
            result = session.get(object_key)
            # Read the entire stream at once (necessary for content_type)
            image_data = result.payload.read()

            # Detect content type from the image data
            return HttpResponse(image_data, content_type=result.metadata.content_type)

        except ClientError as e:
            if e.status == 404:
                logger.warning(
                    "Image not found in objectstore",
                    extra={
                        "organization_id": organization_id,
                        "project_id": project_id,
                        "image_id": image_id,
                    },
                )

                # Upload failed, return appropriate error
                return HttpResponse({"error": "Not found"}, status=404)

            logger.warning(
                "Failed to retrieve image from objectstore",
                extra={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "image_id": image_id,
                    "error": str(e),
                    "status": e.status,
                },
            )
            return HttpResponse({"error": "Failed to retrieve image"}, status=500)

        except Exception:
            logger.exception(
                "Unexpected error retrieving image",
                extra={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "image_id": image_id,
                },
            )
            return HttpResponse({"error": "Internal server error"}, status=500)
