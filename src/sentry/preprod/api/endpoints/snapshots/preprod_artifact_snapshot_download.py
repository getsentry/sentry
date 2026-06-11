from __future__ import annotations

import logging
import os
import resource
import sys
import time
import zipfile
from collections import defaultdict
from collections.abc import Generator
from concurrent.futures import as_completed
from io import BytesIO

import orjson
from django.conf import settings
from django.http import StreamingHttpResponse
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
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
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.response_types import DetailResponse
from sentry.auth.staff import is_active_staff
from sentry.models.organization import Organization
from sentry.objectstore import get_preprod_session
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.manifest import SnapshotManifest
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor
from sentry.utils.zip import is_unsafe_path

logger = logging.getLogger(__name__)

FETCH_MAX_WORKERS = 16
FETCH_BATCH_SIZE = 100
BATCH_TIMEOUT = 300


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


@extend_schema(tags=["Snapshots"])
@cell_silo_endpoint
class OrganizationPreprodSnapshotDownloadEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (OrganizationReleasePermission,)

    @extend_schema(
        operation_id="downloadOrganizationPreprodArtifactSnapshot",
        summary="Download Snapshot images as ZIP",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                name="snapshot_id",
                type=str,
                location="path",
                required=True,
                description="The ID of the snapshot to download.",
            ),
        ],
        request=None,
        responses={
            200: OpenApiResponse(description="A ZIP archive containing all snapshot images."),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self, request: Request, organization: Organization, snapshot_id: str
    ) -> Response[DetailResponse] | StreamingHttpResponse:
        """
        Download all images in a snapshot as a ZIP archive.

        The response is a streaming `application/zip` file. Images that share
        the same content hash are deduplicated during fetch but written under
        their original filenames in the archive.

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
            images_written = 0
            bytes_yielded = 0
            batches_completed = 0
            stream_start = time.monotonic()
            last_yield_time = stream_start
            exit_reason = "unknown"

            def _rss_mb() -> int:
                # ru_maxrss is in KB on Linux, bytes on macOS
                rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
                return rss // 1024 if sys.platform == "linux" else rss // (1024 * 1024)

            logger.info(
                "preprod_snapshot_download.stream_start",
                extra={
                    "preprod_artifact_id": artifact.id,
                    "unique_hashes": len(unique_hashes),
                    "total_filenames": sum(len(v) for v in hash_to_filenames.values()),
                    "pid": os.getpid(),
                    "rss_mb": _rss_mb(),
                },
            )

            def fetch_image(image_hash: str) -> tuple[str, bytes | None, int]:
                t0 = time.monotonic()
                try:
                    data = session.get(f"{key_prefix}/{image_hash}").payload.read()
                    return (image_hash, data, int((time.monotonic() - t0) * 1000))
                except Exception:
                    logger.exception(
                        "preprod_snapshot_download.image_fetch_failed",
                        extra={
                            "preprod_artifact_id": artifact.id,
                            "image_hash": image_hash,
                        },
                    )
                    return (image_hash, None, int((time.monotonic() - t0) * 1000))

            executor = ContextPropagatingThreadPoolExecutor(max_workers=FETCH_MAX_WORKERS)
            try:
                # Process in batches to cap memory and keep zip bytes
                # flowing to the client progressively.
                for batch_start in range(0, len(unique_hashes), FETCH_BATCH_SIZE):
                    batch = unique_hashes[batch_start : batch_start + FETCH_BATCH_SIZE]
                    batch_num = batch_start // FETCH_BATCH_SIZE
                    batch_t0 = time.monotonic()
                    fetch_durations: list[int] = []
                    max_yield_gap_ms = 0
                    futures = [executor.submit(fetch_image, h) for h in batch]
                    try:
                        # as_completed() streams results as they finish,
                        # timeout caps how long we wait for the whole batch.
                        for future in as_completed(futures, timeout=BATCH_TIMEOUT):
                            image_hash, data, fetch_ms = future.result()
                            fetch_durations.append(fetch_ms)
                            if data is None:
                                failed_count += 1
                                continue
                            for filename in hash_to_filenames[image_hash]:
                                zf.writestr(filename, data)
                                images_written += 1
                            chunk = buf.drain()
                            if chunk:
                                now = time.monotonic()
                                gap_ms = int((now - last_yield_time) * 1000)
                                if gap_ms > max_yield_gap_ms:
                                    max_yield_gap_ms = gap_ms
                                last_yield_time = now
                                bytes_yielded += len(chunk)
                                yield chunk
                    except TimeoutError:
                        failed_count += len(batch) - sum(1 for f in futures if f.done())
                        logger.warning(
                            "preprod_snapshot_download.batch_timeout",
                            extra={
                                "preprod_artifact_id": artifact.id,
                                "batch_num": batch_num,
                            },
                        )

                    batches_completed += 1
                    sorted_durations = sorted(fetch_durations) if fetch_durations else [0]
                    logger.info(
                        "preprod_snapshot_download.batch_complete",
                        extra={
                            "preprod_artifact_id": artifact.id,
                            "batch_num": batch_num,
                            "batch_size": len(batch),
                            "batch_duration_ms": int((time.monotonic() - batch_t0) * 1000),
                            "elapsed_s": round(time.monotonic() - stream_start, 1),
                            "images_written": images_written,
                            "bytes_yielded": bytes_yielded,
                            "max_yield_gap_ms": max_yield_gap_ms,
                            "fetch_p50_ms": sorted_durations[len(sorted_durations) // 2],
                            "fetch_p99_ms": sorted_durations[
                                min(len(sorted_durations) - 1, int(len(sorted_durations) * 0.99))
                            ],
                            "fetch_max_ms": sorted_durations[-1],
                            "rss_mb": _rss_mb(),
                        },
                    )

                exit_reason = "complete"
                logger.info(
                    "preprod_snapshot_download.stream_complete",
                    extra={
                        "preprod_artifact_id": artifact.id,
                        "images_written": images_written,
                        "bytes_yielded": bytes_yielded,
                        "failed_count": failed_count,
                        "batches_completed": batches_completed,
                        "duration_s": round(time.monotonic() - stream_start, 1),
                        "rss_mb": _rss_mb(),
                    },
                )

                if failed_count:
                    logger.warning(
                        "preprod_snapshot_download.image_fetch_failures",
                        extra={
                            "preprod_artifact_id": artifact.id,
                            "failed_count": failed_count,
                            "total_count": len(unique_hashes),
                        },
                    )
            except GeneratorExit:
                exit_reason = "client_disconnect"
                raise
            except Exception:
                exit_reason = "exception"
                logger.exception(
                    "preprod_snapshot_download.stream_error",
                    extra={
                        "preprod_artifact_id": artifact.id,
                        "images_written": images_written,
                        "bytes_yielded": bytes_yielded,
                        "batches_completed": batches_completed,
                        "elapsed_s": round(time.monotonic() - stream_start, 1),
                    },
                )
                raise
            finally:
                # wait=False so hung objectstore reads from timed-out batches
                # don't block the generator and eventually the WSGI worker.
                executor.shutdown(wait=False, cancel_futures=True)
                zf.close()

                # Drain the final ZIP central directory bytes for accurate logging
                final_chunk = buf.drain()
                if final_chunk:
                    bytes_yielded += len(final_chunk)

                logger.info(
                    "preprod_snapshot_download.stream_finally",
                    extra={
                        "preprod_artifact_id": artifact.id,
                        "exit_reason": exit_reason,
                        "images_written": images_written,
                        "bytes_yielded": bytes_yielded,
                        "batches_completed": batches_completed,
                        "failed_count": failed_count,
                        "elapsed_s": round(time.monotonic() - stream_start, 1),
                        "rss_mb": _rss_mb(),
                        "pid": os.getpid(),
                    },
                )

            if final_chunk:
                yield final_chunk

        response = StreamingHttpResponse(_stream_zip(), content_type="application/zip")
        response["Content-Disposition"] = (
            f'attachment; filename="snapshot_images_{artifact.id}.zip"'
        )
        return response
