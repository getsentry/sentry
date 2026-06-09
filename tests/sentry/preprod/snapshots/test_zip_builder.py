from __future__ import annotations

import zipfile
from io import BytesIO
from unittest.mock import MagicMock

import pytest

from sentry.preprod.snapshots.manifest import ImageMetadata, SnapshotManifest
from sentry.preprod.snapshots.zip_builder import (
    SnapshotZipBuildError,
    archive_object_key,
    build_snapshot_zip,
)


def _meta(content_hash: str) -> ImageMetadata:
    return ImageMetadata(content_hash=content_hash, width=10, height=10)


def _session(data_by_key: dict[str, bytes]) -> MagicMock:
    def _get(key):
        result = MagicMock()
        if key in data_by_key:
            result.payload.read.return_value = data_by_key[key]
        else:
            raise Exception(f"missing key: {key}")
        return result

    session = MagicMock()
    session.get.side_effect = _get
    return session


def test_build_snapshot_zip_writes_all_images_and_dedupes() -> None:
    manifest = SnapshotManifest(
        images={
            "a.png": _meta("hash_a"),
            "b.png": _meta("hash_b"),
            "c.png": _meta("hash_a"),  # shares hash_a -> dedup fetch, two filenames
        }
    )
    key_prefix = "1/2"
    session = _session({"1/2/hash_a": b"AAA", "1/2/hash_b": b"BBB"})

    out = BytesIO()
    build_snapshot_zip(manifest, session, key_prefix, out, artifact_id=99)

    out.seek(0)
    with zipfile.ZipFile(out) as zf:
        assert sorted(zf.namelist()) == ["a.png", "b.png", "c.png"]
        assert zf.read("a.png") == b"AAA"
        assert zf.read("c.png") == b"AAA"
        assert zf.read("b.png") == b"BBB"
    # hash_a fetched once despite two filenames
    assert session.get.call_count == 2


def test_build_snapshot_zip_empty_manifest() -> None:
    manifest = SnapshotManifest(images={})
    session = _session({})

    out = BytesIO()
    build_snapshot_zip(manifest, session, "1/2", out, artifact_id=99)

    out.seek(0)
    with zipfile.ZipFile(out) as zf:
        assert zf.namelist() == []
    assert session.get.call_count == 0


def test_build_snapshot_zip_raises_on_fetch_failure() -> None:
    manifest = SnapshotManifest(images={"a.png": _meta("hash_a")})
    session = _session({})  # every get raises

    with pytest.raises(SnapshotZipBuildError):
        build_snapshot_zip(manifest, session, "1/2", BytesIO(), artifact_id=99)


def test_archive_object_key_is_deterministic() -> None:
    assert archive_object_key(284978) == "snapshot_archives/284978.zip"
