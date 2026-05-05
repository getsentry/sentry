from __future__ import annotations

import logging

from django.http import HttpResponse
from objectstore_client.client import RequestError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.objectstore import get_preprod_session
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)


@cell_silo_endpoint
class ProjectPreprodArtifactImageEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    # Higher limits than default (40 rps, 25 concurrent) since this proxies images from Objectstore (2.5k rps, 1k concurrent capacity).
    # Snapshot pages load many images in parallel, so per-user is 200 rps/100 concurrent and per-org is 2k rps/100 concurrent.
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=200, window=1, concurrent_limit=100),
                RateLimitCategory.USER: RateLimit(limit=200, window=1, concurrent_limit=100),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=2000, window=1, concurrent_limit=100
                ),
            }
        }
    )

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
        except RequestError as e:
            if e.status == 404:
                return Response({"detail": "Image not found"}, status=404)
            logger.exception(
                "Unexpected error retrieving image",
                extra={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "image_id": image_id,
                },
            )
            return Response({"detail": "Internal server error"}, status=500)
        except Exception:
            logger.exception(
                "Unexpected error retrieving image",
                extra={
                    "organization_id": organization_id,
                    "project_id": project_id,
                    "image_id": image_id,
                },
            )
            return Response({"detail": "Internal server error"}, status=500)
