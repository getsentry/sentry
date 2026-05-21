from __future__ import annotations

import logging
import zipfile
from collections import defaultdict
from collections.abc import Generator
from io import BytesIO

import orjson
from django.conf import settings
from django.http import StreamingHttpResponse
from django.http.response import HttpResponseBase
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
from sentry.auth.staff import is_active_staff
from sentry.models.organization import Organization
from sentry.objectstore import get_preprod_session
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.manifest import SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.zip import is_unsafe_path

logger = logging.getLogger(__name__)

FETCH_BATCH_SIZE = 200
FETCH_MAX_WORKERS = 32


class _DrainableBuffer:
    def __init__(self) -> None:
        self._buf = BytesIO()
        self._pos = 0

    def write(self, data: bytes) -> int:
        self._buf.write(data)
        self._pos += len(data)
        return len(data)

    def tell(self) -> int:
        return self._pos

    def seekable(self) -> bool:
        return False

    def flush(self) -> None:
        pass

    def close(self) -> None:
        pass

    def drain(self) -> bytes:
        self._buf.seek(0)
        data = self._buf.read()
        self._buf.seek(0)
        self._buf.truncate()
        return data


def _build_hash_to_filenames(
    manifest: SnapshotManifest,
) -> dict[str, list[str]]:
    result: dict[str, list[str]] = defaultdict(list)
    for filename, meta in manifest.images.items():
        if not is_unsafe_path(filename):
            result[meta.content_hash].append(filename)
    return result


@cell_silo_endpoint
class OrganizationPreprodSnapshotDownloadEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    permission_classes = (OrganizationReleasePermission,)

    def get(
        self, request: Request, organization: Organization, snapshot_id: str
    ) -> HttpResponseBase:
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

        session = get_preprod_session(organization.id, artifact.project_id)

        try:
            get_response = session.get(manifest_key)
            manifest_data = orjson.loads(get_response.payload.read())
            manifest = SnapshotManifest(**manifest_data)
        except Exception:
            logger.exception(
                "preprod_snapshot_download.manifest_fetch_failed",
                extra={
                    "preprod_artifact_id": artifact.id,
                    "manifest_key": manifest_key,
                },
            )
            return Response({"detail": "Internal server error"}, status=500)

        hash_to_filenames = _build_hash_to_filenames(manifest)
        unique_hashes = list(hash_to_filenames.keys())
        key_prefix = f"{organization.id}/{artifact.project_id}"

        def _stream_zip() -> Generator[bytes]:
            buf = _DrainableBuffer()
            zf = zipfile.ZipFile(buf, "w", zipfile.ZIP_STORED)
            failed_count = 0

            def fetch_image(image_hash: str) -> tuple[str, bytes | None]:
                try:
                    data = session.get(f"{key_prefix}/{image_hash}").payload.read()
                    return (image_hash, data)
                except Exception:
                    logger.exception(
                        "preprod_snapshot_download.image_fetch_failed",
                        extra={
                            "preprod_artifact_id": artifact.id,
                            "image_hash": image_hash,
                        },
                    )
                    return (image_hash, None)

            try:
                with ContextPropagatingThreadPoolExecutor(
                    max_workers=FETCH_MAX_WORKERS
                ) as executor:
                    for batch_start in range(0, len(unique_hashes), FETCH_BATCH_SIZE):
                        batch = unique_hashes[batch_start : batch_start + FETCH_BATCH_SIZE]

                        for image_hash, data in executor.map(fetch_image, batch):
                            if data is None:
                                failed_count += 1
                                continue
                            for filename in hash_to_filenames[image_hash]:
                                zf.writestr(filename, data)

                        chunk = buf.drain()
                        if chunk:
                            yield chunk

                if failed_count:
                    logger.warning(
                        "preprod_snapshot_download.image_fetch_failures",
                        extra={
                            "preprod_artifact_id": artifact.id,
                            "failed_count": failed_count,
                            "total_count": len(unique_hashes),
                        },
                    )
            finally:
                zf.close()

            chunk = buf.drain()
            if chunk:
                yield chunk

        response = StreamingHttpResponse(_stream_zip(), content_type="application/zip")
        response["Content-Disposition"] = (
            f'attachment; filename="snapshot_images_{artifact.id}.zip"'
        )
        return response
