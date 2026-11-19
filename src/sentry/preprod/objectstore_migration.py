from __future__ import annotations

import hashlib
from collections.abc import Iterator
from dataclasses import dataclass
from tempfile import TemporaryFile
from typing import Any

from django.db import models, router, transaction
from django.db.models import Q

from sentry.models.files.file import File
from sentry.objectstore import UsecaseId
from sentry.preprod.models import (
    PreprodArtifact,
    PreprodArtifactSizeComparison,
    PreprodArtifactSizeMetrics,
)
from sentry.preprod.objectstore import ObjectstoreFile


@dataclass
class LegacyPayload:
    owners: models.QuerySet[Any]
    file_field: str
    path_field: str
    file_id: int
    usecase: UsecaseId
    filename: str

    def current_owners(self) -> models.QuerySet[Any]:
        return self.owners.filter(
            **{self.file_field: self.file_id, self.path_field + "__isnull": True}
        )


def legacy_payloads(artifact: PreprodArtifact) -> Iterator[LegacyPayload]:
    builds = PreprodArtifact.objects.filter(pk=artifact.pk)
    if artifact.file_id is not None and artifact.storage_path is None:
        yield LegacyPayload(
            builds,
            "file_id",
            "storage_path",
            artifact.file_id,
            UsecaseId.PREPROD_ARTIFACTS,
            f"preprod_artifact_{artifact.id}.zip",
        )
    if (
        artifact.installable_app_file_id is not None
        and artifact.installable_app_storage_path is None
    ):
        yield LegacyPayload(
            builds,
            "installable_app_file_id",
            "installable_app_storage_path",
            artifact.installable_app_file_id,
            UsecaseId.PREPROD_DISTRIBUTION,
            "installable",
        )

    metrics = PreprodArtifactSizeMetrics.objects.filter(
        preprod_artifact=artifact, analysis_storage_path__isnull=True
    ).exclude(analysis_file_id=None)
    # All components of an analysis point to the same JSON. Move their references together.
    for file_id in metrics.order_by().values_list("analysis_file_id", flat=True).distinct():
        assert file_id is not None
        yield LegacyPayload(
            metrics,
            "analysis_file_id",
            "analysis_storage_path",
            file_id,
            UsecaseId.PREPROD_SIZE,
            "analysis.json",
        )

    comparisons = PreprodArtifactSizeComparison.objects.filter(
        head_size_analysis__preprod_artifact=artifact, storage_path__isnull=True
    ).exclude(file_id=None)
    for file_id in comparisons.order_by().values_list("file_id", flat=True).distinct():
        assert file_id is not None
        yield LegacyPayload(
            comparisons,
            "file_id",
            "storage_path",
            file_id,
            UsecaseId.PREPROD_SIZE,
            "comparison.json",
        )


def _still_referenced(file_id: int) -> bool:
    return (
        PreprodArtifact.objects.filter(
            Q(file_id=file_id) | Q(installable_app_file_id=file_id)
        ).exists()
        or PreprodArtifactSizeMetrics.objects.filter(analysis_file_id=file_id).exists()
        or PreprodArtifactSizeComparison.objects.filter(file_id=file_id).exists()
    )


def migrate_payload(artifact: PreprodArtifact, payload: LegacyPayload) -> bool:
    try:
        source = File.objects.get(pk=payload.file_id)
    except File.DoesNotExist:
        if payload.current_owners().exists():
            raise
        return False

    digest = hashlib.sha1()
    with TemporaryFile() as tmp:
        with source.getfile() as stream:
            while chunk := stream.read(1024 * 1024):
                tmp.write(chunk)
                digest.update(chunk)
        size = tmp.tell()
        if (source.checksum and source.checksum != digest.hexdigest()) or (
            source.size is not None and source.size != size
        ):
            raise ValueError(f"Filestore integrity mismatch for file {source.id}")
        tmp.seek(0)
        stored = ObjectstoreFile.put(payload.usecase, artifact.project, tmp, size, payload.filename)

    try:
        copied_digest = hashlib.sha1()
        with stored.getfile() as stream:
            while chunk := stream.read(1024 * 1024):
                copied_digest.update(chunk)
        if copied_digest.digest() != digest.digest():
            raise ValueError(f"Objectstore integrity mismatch for file {source.id}")
    except Exception:
        stored.delete()
        raise

    # File I/O is complete. Serialize retirement of a possibly shared source and only
    # switch rows that still refer to the exact bytes we copied.
    with transaction.atomic(using=router.db_for_write(File)):
        locked_source = File.objects.select_for_update().get_or_none(pk=source.pk)
        updated = 0
        if locked_source is not None:
            updated = payload.current_owners().update(
                **{payload.file_field: None, payload.path_field: stored.key}
            )
            if updated and not _still_referenced(source.id):
                locked_source.delete()

    if not updated:
        stored.delete()
    return bool(updated)
