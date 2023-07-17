import zipfile
from datetime import timedelta
from hashlib import sha1
from io import BytesIO
from typing import Any, Dict
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.utils import timezone
from freezegun import freeze_time

from sentry.debug_files.artifact_bundles import (
    BundleMeta,
    FlatFileIdentifier,
    FlatFileIndex,
    FlatFileIndexingState,
    FlatFileIndexStore,
    get_redis_cluster_for_artifact_bundles,
    index_bundle_in_flat_file,
    set_flat_files_being_indexed_if_null,
)
from sentry.models import File, FileBlob
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleFlatFileIndex,
    ArtifactBundleIndex,
)
from sentry.tasks.assemble import assemble_artifacts
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.utils import json


def make_compressed_zip_file(files):
    def remove_and_return(dictionary, key):
        dictionary.pop(key)
        return dictionary

    compressed = BytesIO()
    with zipfile.ZipFile(compressed, mode="w") as zip_file:
        for file_path, info in files.items():
            zip_file.writestr(file_path, bytes(info["content"]))

        zip_file.writestr(
            "manifest.json",
            json.dumps(
                {
                    # We remove the "content" key in the original dict, thus no subsequent calls should be made.
                    "files": {
                        file_path: remove_and_return(info, "content")
                        for file_path, info in files.items()
                    }
                }
            ),
        )
    compressed.seek(0)

    return compressed.getvalue()


def upload_bundle(bundle_file, project, release=None, dist=None):
    blob1 = FileBlob.from_file(ContentFile(bundle_file))
    total_checksum = sha1(bundle_file).hexdigest()

    return assemble_artifacts(
        org_id=project.organization.id,
        project_ids=[project.id],
        version=release,
        dist=dist,
        checksum=total_checksum,
        chunks=[blob1.checksum],
        upload_as_artifact_bundle=True,
    )


def get_artifact_bundles(project, release_name="", dist_name=""):
    return list(
        ArtifactBundle.objects.filter(
            organization_id=project.organization.id,
            projectartifactbundle__project_id=project.id,
            releaseartifactbundle__release_name=release_name,
            releaseartifactbundle__dist_name=dist_name,
        )
    )


def get_indexed_files(project, release_name="", dist_name="", distinct=False):
    query = ArtifactBundleIndex.objects.filter(
        organization_id=project.organization.id,
        artifact_bundle__projectartifactbundle__project_id=project.id,
        artifact_bundle__releaseartifactbundle__release_name=release_name,
        artifact_bundle__releaseartifactbundle__dist_name=dist_name,
    ).order_by("url", "-date_last_modified")
    if distinct:
        query = query.distinct("url")
    return list(query)


class ArtifactLookupTest(TestCase):
    def clear_cache(self):
        redis_client = get_redis_cluster_for_artifact_bundles()
        redis_client.flushall()

    @with_feature("organizations:sourcemaps-bundle-indexing")
    def test_indexing_artifacts(self):
        self.clear_cache()

        bundle = make_compressed_zip_file(
            {
                "path/in/zip/foo": {
                    "url": "~/path/to/app.js",
                    "content": b"app_idx1",
                },
                "path/in/zip/bar": {
                    "url": "~/path/to/other1.js",
                    "content": b"other1_idx1",
                },
            }
        )
        upload_bundle(bundle, self.project, "1.0.0")

        # the first upload will not index anything
        bundles = get_artifact_bundles(self.project, "1.0.0")
        assert len(bundles) == 1
        indexed = get_indexed_files(self.project, "1.0.0")
        assert len(indexed) == 0

        bundle = make_compressed_zip_file(
            {
                "path/in/zip/foo": {
                    "url": "~/path/to/app.js",
                    "content": b"app_idx1",
                },
                "path/in/zip/bar": {
                    "url": "~/path/to/other1.js",
                    "content": b"other1_idx1",
                },
            }
        )
        upload_bundle(bundle, self.project, "1.0.0")

        # Uploading the same bundle a second time which internally still creates two artifact bundles, which both
        # cover the same set of files.

        bundles = get_artifact_bundles(self.project, "1.0.0")
        assert len(bundles) == 2
        indexed = get_indexed_files(self.project, "1.0.0", distinct=True)
        assert len(indexed) == 2

        assert indexed[0].url == "~/path/to/app.js"
        assert indexed[0].artifact_bundle == bundles[1]
        assert indexed[1].url == "~/path/to/other1.js"
        assert indexed[1].artifact_bundle == bundles[1]

        bundle = make_compressed_zip_file(
            {
                "path/in/zip/foo": {
                    "url": "~/path/to/app.js",
                    "content": b"app_idx2",
                },
                "path/in/zip/bar": {
                    "url": "~/path/to/other2.js",
                    "content": b"other2_idx1",
                },
            }
        )
        upload_bundle(bundle, self.project, "1.0.0")

        # the second upload will backfill everything that needs indexing
        bundles = get_artifact_bundles(self.project, "1.0.0")
        assert len(bundles) == 3
        indexed = get_indexed_files(self.project, "1.0.0", distinct=True)
        assert len(indexed) == 3

        # here, we use the more recent bundle for the shared file,
        # all other files are disjoint in this example
        assert indexed[0].url == "~/path/to/app.js"
        assert indexed[0].artifact_bundle == bundles[2]
        assert indexed[1].url == "~/path/to/other1.js"
        assert indexed[1].artifact_bundle == bundles[1]
        assert indexed[2].url == "~/path/to/other2.js"
        assert indexed[2].artifact_bundle == bundles[2]


class FlatFileTestCase(TestCase):
    def mock_artifact_bundle(self, manifest):
        file = make_compressed_zip_file(manifest)

        file_obj = File.objects.create(name="bundle.zip", type="artifact.bundle")
        file_obj.putfile(ContentFile(file))

        now = timezone.now()

        return ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            bundle_id="5b14b2e6-141a-4584-a1bf-3b306af9d846",
            file=file_obj,
            artifact_count=10,
            date_uploaded=now,
            date_added=now,
            date_last_modified=now,
        )

    def mock_artifact_bundle_flat_file_index(self, release, dist, file_contents):
        return ArtifactBundleFlatFileIndex.create_flat_file_index(
            project_id=self.project.id, release=release, dist=dist, file_contents=file_contents
        )

    @staticmethod
    def mock_flat_file_index():
        return {
            "bundles": [
                BundleMeta(id=1, timestamp=timezone.now() - timedelta(hours=1)),
                BundleMeta(id=2, timestamp=timezone.now()),
            ],
            "files_by_url": {"~/app.js": [0], "~/main.js": [1, 0]},
        }


class FlatFileIndexingTest(FlatFileTestCase):
    def mock_simple_artifact_bundle(self, with_debug_ids: bool = False):
        manifest: Dict[str, Any] = {
            "path/in/zip/foo": {
                "url": "~/app.js",
                "type": "minified_source",
                "content": b"app_js",
            },
            "path/in/zip/bar": {
                "url": "~/main.js",
                "content": b"main_js",
                "type": "minified_source",
            },
        }

        if with_debug_ids:
            manifest["path/in/zip/foo"]["headers"] = {
                "debug-id": "f206e0e7-3d0c-41cb-bccc-11b716728e27"
            }
            manifest["path/in/zip/bar"]["headers"] = {
                "debug-id": "5c23c9a2-ffb8-49f4-8cc9-fbea9abe4493"
            }

        return self.mock_artifact_bundle(manifest)

    def test_index_bundle_in_flat_file_with_only_release(self):
        release = "1.0"
        dist = "android"

        artifact_bundle = self.mock_simple_artifact_bundle()
        identifier = FlatFileIdentifier(
            project_id=self.project.id,
            release=release,
            dist=dist,
        )

        result = index_bundle_in_flat_file(artifact_bundle, identifier)

        assert result == FlatFileIndexingState.SUCCESS
        assert ArtifactBundleFlatFileIndex.objects.get(
            project_id=self.project.id, release_name=release, dist_name=dist
        )

    def test_index_bundle_in_flat_file_with_debug_ids(self):
        artifact_bundle = self.mock_simple_artifact_bundle(with_debug_ids=True)
        identifier = FlatFileIdentifier(project_id=self.project.id)

        result = index_bundle_in_flat_file(artifact_bundle, identifier)

        assert result == FlatFileIndexingState.SUCCESS
        assert ArtifactBundleFlatFileIndex.objects.get(
            project_id=self.project.id, release_name="", dist_name=""
        )

    def test_index_bundle_in_flat_file_with_release_and_debug_ids(self):
        release = "1.0"
        dist = "android"

        artifact_bundle = self.mock_simple_artifact_bundle(with_debug_ids=True)
        identifier = FlatFileIdentifier(
            project_id=self.project.id,
            release=release,
            dist=dist,
        )

        result = index_bundle_in_flat_file(artifact_bundle, identifier)

        assert result == FlatFileIndexingState.SUCCESS
        assert ArtifactBundleFlatFileIndex.objects.get(
            project_id=self.project.id, release_name=release, dist_name=dist
        )
        assert ArtifactBundleFlatFileIndex.objects.get(
            project_id=self.project.id, release_name="", dist_name=""
        )

    @patch("sentry.debug_files.artifact_bundles.FlatFileIndex._build")
    def test_index_bundle_in_flat_file_with_error(self, _build):
        _build.side_effect = Exception

        artifact_bundle = self.mock_simple_artifact_bundle(with_debug_ids=True)
        identifier = FlatFileIdentifier(project_id=self.project.id)

        result = index_bundle_in_flat_file(artifact_bundle, identifier)

        assert result == FlatFileIndexingState.ERROR
        assert not ArtifactBundleFlatFileIndex.objects.filter(
            project_id=self.project.id, release_name="", dist_name=""
        ).exists()

    def test_index_bundle_in_flat_file_with_conflict(self):
        release = "1.0"
        dist = "android"
        artifact_bundle = self.mock_simple_artifact_bundle(with_debug_ids=True)

        identifier = FlatFileIdentifier(
            project_id=self.project.id,
            release=release,
            dist=dist,
        )

        # We mark both flat files as being indexed.
        set_flat_files_being_indexed_if_null([identifier, identifier.to_indexing_by_debug_id()])

        result = index_bundle_in_flat_file(artifact_bundle, identifier)

        assert result == FlatFileIndexingState.CONFLICT
        assert not ArtifactBundleFlatFileIndex.objects.filter(
            project_id=self.project.id, release_name=release, dist_name=dist
        ).exists()
        assert not ArtifactBundleFlatFileIndex.objects.filter(
            project_id=self.project.id, release_name="", dist_name=""
        ).exists()


@freeze_time("2023-07-13T10:00:00.000Z")
class FlatFileIndexTest(FlatFileTestCase):
    @patch("sentry.debug_files.artifact_bundles.FlatFileIndexStore")
    def test_flat_file_index_with_no_index_stored_and_release(self, flat_file_index_store):
        flat_file_index_store.load.return_value = {}
        flat_file_index_store.identifier = FlatFileIdentifier(
            project_id=self.project.id,
            release="1.0",
            dist="android",
        )

        artifact_bundle = self.mock_artifact_bundle(
            {
                "path/in/zip/foo": {
                    "url": "~/path/to/app.js",
                    "type": "minified_source",
                    "content": b"app_idx1",
                },
                "path/in/zip/bar": {
                    "url": "~/path/to/other1.js",
                    "content": b"other1_idx1",
                    "type": "minified_source",
                },
            }
        )
        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as archive:
            flat_file_index = FlatFileIndex.build(store=flat_file_index_store)
            assert flat_file_index is not None
            flat_file_index.merge(artifact_bundle, archive)
            flat_file_index.save()

        flat_file_index_store.save.assert_called_once_with(
            {
                "bundles": [
                    BundleMeta(id=artifact_bundle.id, timestamp=artifact_bundle.date_last_modified)
                ],
                "files_by_url": {
                    "~/path/to/app.js": [0],
                    "~/path/to/other1.js": [0],
                },
            }
        )

    @patch("sentry.debug_files.artifact_bundles.FlatFileIndexStore")
    def test_flat_file_index_with_no_index_stored_and_debug_ids(self, flat_file_index_store):
        flat_file_index_store.load.return_value = {}
        flat_file_index_store.identifier = FlatFileIdentifier(project_id=self.project.id)

        artifact_bundle = self.mock_artifact_bundle(
            {
                "path/in/zip/foo": {
                    "url": "~/path/to/app.js",
                    "type": "minified_source",
                    "content": b"app_idx1",
                    "headers": {"debug-id": "f206e0e7-3d0c-41cb-bccc-11b716728e27"},
                },
                "path/in/zip/bar": {
                    "url": "~/path/to/other1.js",
                    "content": b"other1_idx1",
                    "type": "minified_source",
                    "headers": {"debug-id": "016ac8b3-60cb-427f-829c-7f99c92a6a95"},
                },
            }
        )
        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as archive:
            flat_file_index = FlatFileIndex.build(store=flat_file_index_store)
            assert flat_file_index is not None
            flat_file_index.merge(artifact_bundle, archive)
            flat_file_index.save()

        flat_file_index_store.save.assert_called_once_with(
            {
                "bundles": [
                    BundleMeta(id=artifact_bundle.id, timestamp=artifact_bundle.date_last_modified)
                ],
                "files_by_debug_id": {
                    "f206e0e7-3d0c-41cb-bccc-11b716728e27": [0],
                    "016ac8b3-60cb-427f-829c-7f99c92a6a95": [0],
                },
            }
        )

    @patch("sentry.debug_files.artifact_bundles.FlatFileIndexStore")
    def test_flat_file_index_with_index_stored_and_release(self, flat_file_index_store):
        existing_bundle_id = 0
        existing_bundle_date = timezone.now() - timedelta(hours=1)

        flat_file_index_store.load.return_value = {
            "bundles": [BundleMeta(id=existing_bundle_id, timestamp=existing_bundle_date)],
            "files_by_url": {"~/path/to/app.js": [0]},
        }
        flat_file_index_store.identifier = FlatFileIdentifier(
            project_id=self.project.id, release="1.0", dist="android"
        )

        artifact_bundle = self.mock_artifact_bundle(
            {
                "path/in/zip/foo": {
                    "url": "~/path/to/app.js",
                    "type": "minified_source",
                    "content": b"app_idx1",
                },
                "path/in/zip/bar": {
                    "url": "~/path/to/other1.js",
                    "content": b"other1_idx1",
                    "type": "minified_source",
                },
            }
        )
        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as archive:
            flat_file_index = FlatFileIndex.build(store=flat_file_index_store)
            assert flat_file_index is not None
            flat_file_index.merge(artifact_bundle, archive)
            flat_file_index.save()

        flat_file_index_store.save.assert_called_once_with(
            {
                "bundles": [
                    BundleMeta(id=existing_bundle_id, timestamp=existing_bundle_date),
                    BundleMeta(id=artifact_bundle.id, timestamp=artifact_bundle.date_last_modified),
                ],
                "files_by_url": {
                    "~/path/to/app.js": [0, 1],
                    "~/path/to/other1.js": [1],
                },
            }
        )

    @patch("sentry.debug_files.artifact_bundles.FlatFileIndexStore")
    def test_flat_file_index_with_index_stored_and_debug_ids(self, flat_file_index_store):
        existing_bundle_id = 0
        existing_bundle_date = timezone.now() - timedelta(hours=1)

        flat_file_index_store.load.return_value = {
            "bundles": [BundleMeta(id=existing_bundle_id, timestamp=existing_bundle_date)],
            "files_by_debug_id": {"f206e0e7-3d0c-41cb-bccc-11b716728e27": [0]},
        }
        flat_file_index_store.identifier = FlatFileIdentifier(project_id=self.project.id)

        artifact_bundle = self.mock_artifact_bundle(
            {
                "path/in/zip/foo": {
                    "url": "~/path/to/app.js",
                    "type": "minified_source",
                    "content": b"app_idx1",
                    "headers": {"debug-id": "f206e0e7-3d0c-41cb-bccc-11b716728e27"},
                },
                "path/in/zip/bar": {
                    "url": "~/path/to/other1.js",
                    "content": b"other1_idx1",
                    "type": "minified_source",
                    "headers": {"debug-id": "016ac8b3-60cb-427f-829c-7f99c92a6a95"},
                },
            }
        )
        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as archive:
            flat_file_index = FlatFileIndex.build(store=flat_file_index_store)
            assert flat_file_index is not None
            flat_file_index.merge(artifact_bundle, archive)
            flat_file_index.save()

        flat_file_index_store.save.assert_called_once_with(
            {
                "bundles": [
                    BundleMeta(id=existing_bundle_id, timestamp=existing_bundle_date),
                    BundleMeta(id=artifact_bundle.id, timestamp=artifact_bundle.date_last_modified),
                ],
                "files_by_debug_id": {
                    "f206e0e7-3d0c-41cb-bccc-11b716728e27": [0, 1],
                    "016ac8b3-60cb-427f-829c-7f99c92a6a95": [1],
                },
            }
        )

    @patch("sentry.debug_files.artifact_bundles.FlatFileIndexStore")
    def test_flat_file_index_remove_bundle(self, flat_file_index_store):
        now = timezone.now()

        flat_file_index_store.load.return_value = {
            "bundles": [
                BundleMeta(id=1234, timestamp=now),
                BundleMeta(id=5678, timestamp=now - timedelta(hours=1)),
            ],
            "files_by_debug_id": {
                "2a9e7ab2-50ba-43b5-a8fd-13f6ac1f5976": [1],
                "f206e0e7-3d0c-41cb-bccc-11b716728e27": [0, 1],
                "016ac8b3-60cb-427f-829c-7f99c92a6a95": [0],
            },
        }
        flat_file_index_store.identifier = FlatFileIdentifier(project_id=self.project.id)

        flat_file_index = FlatFileIndex.build(store=flat_file_index_store)
        assert flat_file_index is not None
        flat_file_index.remove(1234)
        flat_file_index.save()

        flat_file_index_store.save.assert_called_once_with(
            {
                "bundles": [
                    BundleMeta(id=5678, timestamp=now - timedelta(hours=1)),
                ],
                "files_by_debug_id": {
                    "2a9e7ab2-50ba-43b5-a8fd-13f6ac1f5976": [0],
                    "f206e0e7-3d0c-41cb-bccc-11b716728e27": [0],
                },
            }
        )


class FlatFileStoreTest(FlatFileTestCase):
    def test_flat_file_store_roundtrip(self):
        release = "1.0"
        dist = "android"

        flat_file_index = self.mock_flat_file_index()

        identifier = FlatFileIdentifier(project_id=self.project.id, release=release, dist=dist)
        store = FlatFileIndexStore(identifier)
        store.save(flat_file_index)

        result = store.load()
        assert result == flat_file_index
