from __future__ import annotations

import logging
from typing import cast

import orjson
from django.conf import settings
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import (
    OrganizationEndpoint,
    OrganizationReleasePermission,
)
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.examples.preprod_examples import PreprodExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.staff import is_active_staff
from sentry.models.organization import Organization
from sentry.objectstore import get_preprod_session
from sentry.preprod.api.models.public.snapshots import SnapshotImageDetailResponseDict
from sentry.preprod.api.models.snapshots.project_preprod_snapshot_models import (
    SnapshotImageDetailImageInfo,
    SnapshotImageDetailResponse,
)
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.manifest import (
    ComparisonImageResult,
    ComparisonManifest,
    ImageMetadata,
    SnapshotManifest,
    image_metadata_extras,
)
from sentry.preprod.snapshots.models import PreprodSnapshotComparison, PreprodSnapshotMetrics

logger = logging.getLogger(__name__)


def _find_image_in_manifest(
    manifest: SnapshotManifest, identifier: str
) -> tuple[str | None, ImageMetadata | None]:
    if identifier in manifest.images:
        return identifier, manifest.images[identifier]
    for fname, meta in manifest.images.items():
        if meta.content_hash == identifier:
            return fname, meta
    return None, None


def _find_image_in_comparison_manifest(
    manifest: ComparisonManifest, identifier: str
) -> tuple[str | None, ComparisonImageResult | None]:
    if identifier in manifest.images:
        return identifier, manifest.images[identifier]
    for fname, result in manifest.images.items():
        if result.base_hash == identifier:
            return fname, result
    return None, None


def _build_image_info(
    image_file_name: str,
    metadata: ImageMetadata,
    global_diff_threshold: float | None,
    org_slug: str,
    project_slug: str,
) -> SnapshotImageDetailImageInfo:
    extra_fields = image_metadata_extras(
        metadata, exclude=frozenset(SnapshotImageDetailImageInfo.__fields__)
    )
    return SnapshotImageDetailImageInfo(
        content_hash=metadata.content_hash,
        display_name=metadata.display_name,
        group=metadata.group,
        image_file_name=image_file_name,
        width=metadata.width,
        height=metadata.height,
        diff_threshold=metadata.diff_threshold
        if metadata.diff_threshold is not None
        else global_diff_threshold,
        description=metadata.description,
        tags=metadata.tags,
        image_url=f"/api/0/projects/{org_slug}/{project_slug}/files/images/{metadata.content_hash}/",
        **extra_fields,
    )


def _resolve_base_image_info(
    image_file_name: str,
    base_manifest: SnapshotManifest | None,
    org_slug: str,
    project_slug: str,
) -> SnapshotImageDetailImageInfo | None:
    if base_manifest is None:
        return None
    base_meta = base_manifest.images.get(image_file_name)
    if base_meta is None:
        return None
    return _build_image_info(
        image_file_name,
        base_meta,
        base_manifest.diff_threshold,
        org_slug,
        project_slug,
    )


def _to_response_dict(resp: SnapshotImageDetailResponse) -> SnapshotImageDetailResponseDict:
    # cast() sanctioned here: pydantic .dict() returns dict[str, Any] with no
    # static link back to SnapshotImageDetailResponseDict. The TypedDict and
    # the Pydantic model are kept in sync by hand at the source of truth.
    return cast(SnapshotImageDetailResponseDict, resp.dict())


# Intentionally uses a flat response format (nullable fields, no conditional shapes)
# rather than matching the details endpoint's SnapshotDiffPair/SnapshotImageResponse split.
# This endpoint is designed for LLM/MCP consumers that benefit from a single uniform shape.
@extend_schema(tags=["Snapshots"])
@cell_silo_endpoint
class OrganizationPreprodSnapshotImageDetailEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationReleasePermission,)

    @extend_schema(
        operation_id="getOrganizationPreprodArtifactSnapshotImage",
        summary="Retrieve Snapshot image detail",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="snapshot_id",
                type=str,
                location="path",
                required=True,
                description="The ID of the snapshot.",
            ),
            OpenApiParameter(
                name="image_identifier",
                type=str,
                location="path",
                required=True,
                description="The image filename or content hash.",
            ),
        ],
        request=None,
        responses={
            200: inline_sentry_response_serializer(
                "SnapshotImageDetailResponse", SnapshotImageDetailResponseDict
            ),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=PreprodExamples.GET_SNAPSHOT_IMAGE_DETAIL,
    )
    def get(
        self,
        request: Request,
        organization: Organization,
        snapshot_id: str,
        image_identifier: str,
    ) -> Response[SnapshotImageDetailResponseDict] | Response[DetailResponse]:
        """
        Retrieve detailed information for a single image within a snapshot.

        The `image_identifier` can be either the image filename or its content
        hash. The response includes head and base image metadata, comparison
        status, diff image URL, diff percentage, and previous filename for
        renames.

        This endpoint uses a flat response format with nullable fields designed
        for LLM/MCP consumers.

        This endpoint requires a bearer token with `project:read` access.
        """
        if not settings.IS_DEV and not features.has(
            "organizations:preprod-snapshots", organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        try:
            artifact = PreprodArtifact.objects.select_related("project").get(
                id=snapshot_id, project__organization_id=organization.id
            )
        except (PreprodArtifact.DoesNotExist, ValueError):
            return Response({"detail": "Snapshot not found"}, status=404)

        if not is_active_staff(request) and not request.access.has_project_access(artifact.project):
            return Response({"detail": "Snapshot not found"}, status=404)

        try:
            snapshot_metrics = artifact.preprodsnapshotmetrics
        except PreprodSnapshotMetrics.DoesNotExist:
            return Response({"detail": "Snapshot metrics not found"}, status=404)

        manifest_key = (snapshot_metrics.extras or {}).get("manifest_key")
        if not manifest_key:
            return Response({"detail": "Manifest key not found"}, status=404)

        try:
            session = get_preprod_session(organization.id, artifact.project_id)
            manifest_data = orjson.loads(session.get(manifest_key).payload.read())
            manifest = SnapshotManifest(**manifest_data)
        except Exception:
            logger.exception(
                "Failed to retrieve snapshot manifest",
                extra={
                    "preprod_artifact_id": artifact.id,
                    "manifest_key": manifest_key,
                },
            )
            return Response({"detail": "Internal server error"}, status=500)

        image_file_name, metadata = _find_image_in_manifest(manifest, image_identifier)

        org_slug = organization.slug
        project_slug = artifact.project.slug

        comparison_manifest: ComparisonManifest | None = None
        base_manifest: SnapshotManifest | None = None
        comparison = (
            PreprodSnapshotComparison.objects.select_related("base_snapshot_metrics")
            .filter(
                head_snapshot_metrics=snapshot_metrics,
                state=PreprodSnapshotComparison.State.SUCCESS,
            )
            .order_by("-id")
            .first()
        )
        if comparison:
            comparison_key = (comparison.extras or {}).get("comparison_key")
            if comparison_key:
                try:
                    comparison_manifest = ComparisonManifest(
                        **orjson.loads(session.get(comparison_key).payload.read())
                    )
                except Exception:
                    logger.exception(
                        "Failed to fetch comparison manifest",
                        extra={"preprod_artifact_id": artifact.id},
                    )

        if comparison_manifest is not None and comparison is not None:
            base_manifest_key = (comparison.base_snapshot_metrics.extras or {}).get("manifest_key")
            if base_manifest_key:
                try:
                    base_manifest = SnapshotManifest(
                        **orjson.loads(session.get(base_manifest_key).payload.read())
                    )
                except Exception:
                    logger.exception(
                        "Failed to fetch base manifest",
                        extra={"preprod_artifact_id": artifact.id},
                    )

        if metadata is None or image_file_name is None:
            if comparison_manifest is not None:
                comp_file_name, comp_result = _find_image_in_comparison_manifest(
                    comparison_manifest, image_identifier
                )
                if comp_result is not None and comp_file_name is not None:
                    if comp_result.status == "removed":
                        resp = SnapshotImageDetailResponse(
                            image_file_name=comp_file_name,
                            comparison_status="removed",
                            head_image=None,
                            base_image=_resolve_base_image_info(
                                comp_file_name, base_manifest, org_slug, project_slug
                            ),
                        )
                        return Response(_to_response_dict(resp))

                    if comp_result.status == "skipped":
                        base_image = _resolve_base_image_info(
                            comp_file_name, base_manifest, org_slug, project_slug
                        )
                        resp = SnapshotImageDetailResponse(
                            image_file_name=comp_file_name,
                            comparison_status="skipped",
                            head_image=base_image,
                            base_image=base_image,
                        )
                        return Response(_to_response_dict(resp))

            return Response({"detail": "Image not found in snapshot"}, status=404)

        head_image = _build_image_info(
            image_file_name, metadata, manifest.diff_threshold, org_slug, project_slug
        )

        comp_result = (
            comparison_manifest.images.get(image_file_name) if comparison_manifest else None
        )
        if comp_result is None:
            resp = SnapshotImageDetailResponse(
                image_file_name=image_file_name,
                head_image=head_image,
            )
            return Response(_to_response_dict(resp))

        status = comp_result.status

        base_fname = image_file_name
        if status == "renamed" and comp_result.previous_image_file_name:
            base_fname = comp_result.previous_image_file_name

        base_image_info = None
        if status in ("changed", "unchanged", "renamed", "errored", "skipped"):
            base_image_info = _resolve_base_image_info(
                base_fname, base_manifest, org_slug, project_slug
            )

        diff_image_url = None
        diff_percentage = None
        if status == "changed" and comp_result.diff_mask_image_id:
            diff_image_url = f"/api/0/projects/{org_slug}/{project_slug}/files/images/{comp_result.diff_mask_image_id}/"
            if comp_result.changed_pixels is not None and comp_result.total_pixels:
                diff_percentage = comp_result.changed_pixels / comp_result.total_pixels

        previous_image_file_name = None
        if status == "renamed":
            previous_image_file_name = comp_result.previous_image_file_name

        resp = SnapshotImageDetailResponse(
            image_file_name=image_file_name,
            comparison_status=status,
            head_image=head_image,
            base_image=base_image_info,
            diff_image_url=diff_image_url,
            diff_percentage=diff_percentage,
            previous_image_file_name=previous_image_file_name,
        )
        return Response(_to_response_dict(resp))
