from __future__ import annotations

import logging
import os
from urllib.parse import quote

from django.http import HttpResponse
from drf_spectacular.utils import OpenApiParameter, extend_schema
from objectstore_client import RequestError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.project import Project
from sentry.objectstore import UsecaseId, get_session
from sentry.preprod.snapshots.storage import get_snapshot_storage
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory

logger = logging.getLogger(__name__)

PREPROD_SIZE_APP_ICON = "preprod_size_app_icon"
PREPROD_SNAPSHOTS = "preprod_snapshots"


def _content_disposition(raw_filename: str | None) -> str | None:
    if not raw_filename:
        return None

    filename = os.path.basename(raw_filename.replace("\\", "/"))
    filename = "".join(c for c in filename if c >= " " and c != "\x7f").replace('"', "").strip()
    if not filename or filename in (".", ".."):
        return None

    try:
        filename.encode("ascii")
        return f'inline; filename="{filename}"'
    except UnicodeEncodeError:
        return f"inline; filename*=utf-8''{quote(filename)}"


@cell_silo_endpoint
class ProjectPreprodArtifactImageEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    # Higher limits than default (40 rps, 25 concurrent) since this proxies images from Objectstore.
    # Snapshot pages load many images in parallel, so per-user is 400 rps/200 concurrent and per-org is 4k rps/200 concurrent.
    # Objectstore's own ceilings are a percentage of a per-pod global_rps and sit well above these:
    # https://github.com/getsentry/ops/blob/master/k8s/services/objectstore/_values.yaml
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=400, window=1, concurrent_limit=200),
                RateLimitCategory.USER: RateLimit(limit=400, window=1, concurrent_limit=200),
                RateLimitCategory.ORGANIZATION: RateLimit(
                    limit=4000, window=1, concurrent_limit=200
                ),
            }
        }
    )

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="image_type",
                type=str,
                location="query",
                required=False,
                enum=[PREPROD_SIZE_APP_ICON, PREPROD_SNAPSHOTS],
                description=(
                    "Use preprod_size_app_icon for size-analysis app icons, or "
                    "preprod_snapshots for snapshot images and diff masks. "
                    "When omitted, legacy app icons are recognized by their icn_ prefix."
                ),
            ),
        ],
    )
    def get(
        self,
        request: Request,
        project: Project,
        image_id: str,
    ) -> HttpResponse:
        image_type = request.GET.get("image_type")
        if image_type not in (None, PREPROD_SIZE_APP_ICON, PREPROD_SNAPSHOTS):
            return Response({"detail": "Invalid image_type"}, status=400)

        organization_id = project.organization_id
        project_id = project.id

        object_key = f"{organization_id}/{project_id}/{image_id}"
        is_app_icon = image_type == PREPROD_SIZE_APP_ICON or (
            image_type is None and image_id.startswith("icn_")
        )
        usecase = UsecaseId.PREPROD_SIZE if is_app_icon else UsecaseId.PREPROD
        session = get_session(usecase, project)

        try:
            result = session.get(object_key)
            if result is None and is_app_icon:
                # TODO: On January 1, 2027, remove the preprod fallback for app icons.
                result = get_session(UsecaseId.PREPROD, project).get(object_key)
            if result is None:
                return Response({"detail": "Image not found"}, status=404)

            # Read the entire stream at once (necessary for content_type)
            image_data = result.payload.read()

            # Detect content type from the image data
            response = HttpResponse(image_data, content_type=result.metadata.content_type)
            # Let "Save Image As" prefill the original filename the frontend supplies.
            content_disposition = _content_disposition(request.GET.get("filename"))
            if content_disposition:
                response["Content-Disposition"] = content_disposition
            return response
        except RequestError:
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
