from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone

from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
from django.http.response import HttpResponseBase
from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationReleasePermission
from sentry.auth.staff import is_active_staff
from sentry.locks import locks
from sentry.models.files.file import File
from sentry.models.organization import Organization
from sentry.preprod.models import PreprodArtifact
from sentry.preprod.snapshots.models import PreprodSnapshotMetrics
from sentry.preprod.snapshots.zip_builder import ZipState, get_zip_state, set_zip_state
from sentry.preprod.snapshots.zip_tasks import build_snapshot_images_zip
from sentry.replays.lib.http import MalformedRangeHeader, UnsatisfiableRange, parse_range_header
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

BUILD_STALE_AFTER = timedelta(minutes=20)
DOWNLOAD_CHUNK_SIZE = 8192


class OrganizationPreprodSnapshotArchivePermission(OrganizationReleasePermission):
    scope_map = {
        **OrganizationReleasePermission.scope_map,
        "HEAD": OrganizationReleasePermission.scope_map["GET"],
    }


def _is_building_fresh(state: ZipState | None) -> bool:
    if not state or state.get("status") != "building":
        return False
    enqueued_at = state.get("enqueued_at")
    if not enqueued_at:
        return False
    return datetime.now(timezone.utc) - datetime.fromisoformat(enqueued_at) < BUILD_STALE_AFTER


def _stream_full(file_obj: File) -> Iterator[bytes]:
    with file_obj.getfile() as fp:
        while True:
            chunk = fp.read(DOWNLOAD_CHUNK_SIZE)
            if not chunk:
                break
            yield chunk


def _stream_range(file_obj: File, start: int, end: int) -> Iterator[bytes]:
    remaining = end - start + 1
    with file_obj.getfile() as fp:
        fp.seek(start)
        while remaining > 0:
            chunk = fp.read(min(DOWNLOAD_CHUNK_SIZE, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


@extend_schema(tags=["Snapshots"])
@cell_silo_endpoint
class OrganizationPreprodSnapshotArchiveEndpoint(OrganizationEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "HEAD": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationPreprodSnapshotArchivePermission,)

    def _resolve(
        self, request: Request, organization: Organization, snapshot_id: str
    ) -> tuple[PreprodArtifact, PreprodSnapshotMetrics] | Response:
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
            metrics = artifact.preprodsnapshotmetrics
        except PreprodSnapshotMetrics.DoesNotExist:
            return Response({"detail": "Snapshot metrics not found"}, status=404)

        if not (metrics.extras or {}).get("manifest_key"):
            return Response({"detail": "Manifest key not found"}, status=404)

        return artifact, metrics

    def _ready_file(self, metrics: PreprodSnapshotMetrics) -> File | None:
        state = get_zip_state(metrics)
        if not state or state.get("status") != "ready" or not state.get("file_id"):
            return None
        return File.objects.filter(id=state["file_id"]).first()

    def _ensure_build(self, artifact: PreprodArtifact, metrics: PreprodSnapshotMetrics) -> str:
        """Return the current status, enqueuing a build if needed. Idempotent."""
        if self._ready_file(metrics) is not None:
            return "ready"

        if _is_building_fresh(get_zip_state(metrics)):
            return "building"

        lock = locks.get(
            f"preprod-snapshot-zip:{artifact.id}",
            duration=30,
            name="build_snapshot_images_zip",
        )
        try:
            with lock.acquire():
                metrics.refresh_from_db()
                if self._ready_file(metrics) is not None:
                    return "ready"
                if _is_building_fresh(get_zip_state(metrics)):
                    return "building"
                enqueued_at = datetime.now(timezone.utc).isoformat()
                set_zip_state(
                    metrics,
                    status="building",
                    enqueued_at=enqueued_at,
                    file_id=None,
                    progress=0,
                )
                build_snapshot_images_zip.apply_async(
                    kwargs={
                        "org_id": artifact.project.organization_id,
                        "project_id": artifact.project_id,
                        "artifact_id": artifact.id,
                        "build_token": enqueued_at,
                    }
                )
                return "building"
        except UnableToAcquireLock:
            return "building"

    def _download(
        self, request: Request, artifact: PreprodArtifact, file_obj: File
    ) -> HttpResponseBase:
        file_size = file_obj.size or 0
        filename = f"snapshot_images_{artifact.id}.zip"
        etag = f'"{file_obj.checksum}"' if file_obj.checksum else None

        range_header = request.META.get("HTTP_RANGE")
        if range_header:
            try:
                ranges = parse_range_header(range_header)
                if not ranges:
                    return HttpResponse(status=400)
                if len(ranges) > 1:
                    raise MalformedRangeHeader("Too many ranges specified.")
                if file_size == 0:
                    return HttpResponse(status=416)
                start, end = ranges[0].make_range(file_size - 1)
                response: HttpResponseBase = StreamingHttpResponse(
                    _stream_range(file_obj, start, end),
                    content_type="application/zip",
                    status=206,
                )
                response["Content-Length"] = end - start + 1
                response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
            except (MalformedRangeHeader, UnsatisfiableRange):
                return HttpResponse(status=416)
            except (ValueError, IndexError):
                return HttpResponse(status=400)
        else:
            response = StreamingHttpResponse(_stream_full(file_obj), content_type="application/zip")
            response["Content-Length"] = file_size

        response["Accept-Ranges"] = "bytes"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        if etag:
            response["ETag"] = etag
        return response

    def head(
        self, request: Request, organization: Organization, snapshot_id: str
    ) -> HttpResponseBase:
        resolved = self._resolve(request, organization, snapshot_id)
        if isinstance(resolved, Response):
            return resolved
        _artifact, metrics = resolved

        file_obj = self._ready_file(metrics)
        if file_obj is None:
            return Response({"detail": "Download not ready"}, status=409)

        response = HttpResponse(content_type="application/zip")
        response["Content-Length"] = file_obj.size or 0
        response["Accept-Ranges"] = "bytes"
        response["Content-Disposition"] = (
            f'attachment; filename="snapshot_images_{snapshot_id}.zip"'
        )
        if file_obj.checksum:
            response["ETag"] = f'"{file_obj.checksum}"'
        return response

    def get(
        self, request: Request, organization: Organization, snapshot_id: str
    ) -> HttpResponseBase:
        resolved = self._resolve(request, organization, snapshot_id)
        if isinstance(resolved, Response):
            return resolved
        artifact, metrics = resolved

        if request.GET.get("download") is not None:
            file_obj = self._ready_file(metrics)
            if file_obj is None:
                return Response({"detail": "Download not ready"}, status=409)
            return self._download(request, artifact, file_obj)

        status = self._ensure_build(artifact, metrics)
        payload: dict[str, object] = {"status": status}
        if status == "building":
            state = get_zip_state(metrics)
            payload["progress"] = state.get("progress") if state else None
        return Response(payload)
