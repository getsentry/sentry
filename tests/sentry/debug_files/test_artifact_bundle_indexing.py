import zipfile
from datetime import timedelta
from io import BytesIO
from typing import Any, Dict
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.utils import timezone
from freezegun import freeze_time

from sentry.debug_files.artifact_bundle_indexing import (
    BundleMeta,
    FlatFileIndex,
    mark_bundle_for_flat_file_indexing,
    update_artifact_bundle_index,
)
from sentry.models import File
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleFlatFileIndex,
)
from sentry.testutils.cases import TestCase
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
        index = ArtifactBundleFlatFileIndex.objects.create(
            project_id=self.project.id,
            release=release,
            dist=dist,
        )
        index.update_flat_file_index(file_contents)
        return index

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

        identifiers = mark_bundle_for_flat_file_indexing(
            artifact_bundle, [self.project.id], release, dist
        )
        bundle_meta = BundleMeta(
            id=artifact_bundle.id,
            timestamp=artifact_bundle.date_last_modified,
        )

        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as archive:
            for identifier in identifiers:
                update_artifact_bundle_index(bundle_meta, archive, identifier)

        assert ArtifactBundleFlatFileIndex.objects.get(
            project_id=self.project.id, release_name=release, dist_name=dist
        )

    def test_index_bundle_in_flat_file_with_debug_ids(self):
        artifact_bundle = self.mock_simple_artifact_bundle(with_debug_ids=True)

        identifiers = mark_bundle_for_flat_file_indexing(
            artifact_bundle, [self.project.id], None, None
        )
        bundle_meta = BundleMeta(
            id=artifact_bundle.id,
            timestamp=artifact_bundle.date_last_modified,
        )

        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as archive:
            for identifier in identifiers:
                update_artifact_bundle_index(bundle_meta, archive, identifier)

        assert ArtifactBundleFlatFileIndex.objects.get(
            project_id=self.project.id, release_name="", dist_name=""
        )

    def test_index_bundle_in_flat_file_with_release_and_debug_ids(self):
        release = "1.0"
        dist = "android"

        artifact_bundle = self.mock_simple_artifact_bundle(with_debug_ids=True)

        identifiers = mark_bundle_for_flat_file_indexing(
            artifact_bundle, [self.project.id], release, dist
        )
        bundle_meta = BundleMeta(
            id=artifact_bundle.id,
            timestamp=artifact_bundle.date_last_modified,
        )

        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as archive:
            for identifier in identifiers:
                update_artifact_bundle_index(bundle_meta, archive, identifier)

        assert ArtifactBundleFlatFileIndex.objects.get(
            project_id=self.project.id, release_name=release, dist_name=dist
        )
        assert ArtifactBundleFlatFileIndex.objects.get(
            project_id=self.project.id, release_name="", dist_name=""
        )

    @patch("sentry.debug_files.artifact_bundle_indexing.FlatFileIndex.to_json")
    def test_index_bundle_in_flat_file_with_error(self, to_json):
        to_json.side_effect = Exception

        artifact_bundle = self.mock_simple_artifact_bundle(with_debug_ids=True)

        identifiers = mark_bundle_for_flat_file_indexing(
            artifact_bundle, [self.project.id], None, None
        )
        bundle_meta = BundleMeta(
            id=artifact_bundle.id,
            timestamp=artifact_bundle.date_last_modified,
        )

        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as archive:
            for identifier in identifiers:
                try:
                    update_artifact_bundle_index(bundle_meta, archive, identifier)
                except Exception:
                    pass

        index = ArtifactBundleFlatFileIndex.objects.get(
            project_id=self.project.id, release_name="", dist_name=""
        )
        assert index.load_flat_file_index() is None

    def test_index_bundle_in_flat_file_with_conflict(self):
        release = "1.0"
        dist = "android"
        artifact_bundle = self.mock_simple_artifact_bundle(with_debug_ids=True)

        identifiers = mark_bundle_for_flat_file_indexing(
            artifact_bundle, [self.project.id], release, dist
        )
        bundle_meta = BundleMeta(
            id=artifact_bundle.id,
            timestamp=artifact_bundle.date_last_modified,
        )

        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as archive:
            for identifier in identifiers:
                update_artifact_bundle_index(bundle_meta, archive, identifier)

            # We run the indexing twice, it should still succeed
            for identifier in identifiers:
                update_artifact_bundle_index(bundle_meta, archive, identifier)

        assert ArtifactBundleFlatFileIndex.objects.filter(
            project_id=self.project.id, release_name=release, dist_name=dist
        ).exists()
        assert ArtifactBundleFlatFileIndex.objects.filter(
            project_id=self.project.id, release_name="", dist_name=""
        ).exists()


@freeze_time("2023-07-13T10:00:00.000Z")
class FlatFileIndexTest(FlatFileTestCase):
    def test_flat_file_index_with_no_index_stored_and_release(self):
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

        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as bundle_archive:
            flat_file_index = FlatFileIndex()
            bundle_meta = BundleMeta(
                id=artifact_bundle.id, timestamp=artifact_bundle.date_last_modified
            )
            flat_file_index.merge_urls(bundle_meta, bundle_archive)

        assert json.loads(flat_file_index.to_json()) == {
            "bundles": [
                {
                    "bundle_id": f"artifact_bundle/{artifact_bundle.id}",
                    "timestamp": "2023-07-13T10:00:00+00:00",
                }
            ],
            "files_by_url": {"~/path/to/app.js": [0], "~/path/to/other1.js": [0]},
            "files_by_debug_id": {},
        }

    def test_flat_file_index_with_no_index_stored_and_debug_ids(self):
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

        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as bundle_archive:
            flat_file_index = FlatFileIndex()
            bundle_meta = BundleMeta(
                id=artifact_bundle.id, timestamp=artifact_bundle.date_last_modified
            )
            flat_file_index.merge_debug_ids(bundle_meta, bundle_archive)

        assert json.loads(flat_file_index.to_json()) == {
            "bundles": [
                {
                    "bundle_id": f"artifact_bundle/{artifact_bundle.id}",
                    "timestamp": "2023-07-13T10:00:00+00:00",
                }
            ],
            "files_by_debug_id": {
                "016ac8b3-60cb-427f-829c-7f99c92a6a95": [0],
                "f206e0e7-3d0c-41cb-bccc-11b716728e27": [0],
            },
            "files_by_url": {},
        }

    def test_flat_file_index_with_index_stored_and_release(self):
        existing_bundle_id = 0
        existing_bundle_date = timezone.now() - timedelta(hours=1)
        existing_json_index = {
            "bundles": [
                {
                    "bundle_id": f"artifact_bundle/{existing_bundle_id}",
                    "timestamp": existing_bundle_date.isoformat(),
                }
            ],
            "files_by_url": {"~/path/to/app.js": [0]},
        }

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

        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as bundle_archive:
            flat_file_index = FlatFileIndex()
            flat_file_index.from_json(json.dumps(existing_json_index))
            bundle_meta = BundleMeta(
                id=artifact_bundle.id, timestamp=artifact_bundle.date_last_modified
            )
            flat_file_index.merge_urls(bundle_meta, bundle_archive)

        assert json.loads(flat_file_index.to_json()) == {
            "bundles": [
                {
                    "bundle_id": f"artifact_bundle/{existing_bundle_id}",
                    "timestamp": "2023-07-13T09:00:00+00:00",
                },
                {
                    "bundle_id": f"artifact_bundle/{artifact_bundle.id}",
                    "timestamp": "2023-07-13T10:00:00+00:00",
                },
            ],
            "files_by_debug_id": {},
            "files_by_url": {"~/path/to/app.js": [0, 1], "~/path/to/other1.js": [1]},
        }

    def test_flat_file_index_with_index_stored_and_debug_ids(self):
        existing_bundle_id = 0
        existing_bundle_date = timezone.now() - timedelta(hours=1)
        existing_json_index = {
            "bundles": [
                {
                    "bundle_id": f"artifact_bundle/{existing_bundle_id}",
                    "timestamp": existing_bundle_date.isoformat(),
                }
            ],
            "files_by_debug_id": {"f206e0e7-3d0c-41cb-bccc-11b716728e27": [0]},
        }

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

        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as bundle_archive:
            flat_file_index = FlatFileIndex()
            flat_file_index.from_json(json.dumps(existing_json_index))
            bundle_meta = BundleMeta(
                id=artifact_bundle.id, timestamp=artifact_bundle.date_last_modified
            )
            flat_file_index.merge_debug_ids(bundle_meta, bundle_archive)

        assert json.loads(flat_file_index.to_json()) == {
            "bundles": [
                {
                    "bundle_id": f"artifact_bundle/{existing_bundle_id}",
                    "timestamp": "2023-07-13T09:00:00+00:00",
                },
                {
                    "bundle_id": f"artifact_bundle/{artifact_bundle.id}",
                    "timestamp": "2023-07-13T10:00:00+00:00",
                },
            ],
            "files_by_debug_id": {
                "016ac8b3-60cb-427f-829c-7f99c92a6a95": [1],
                "f206e0e7-3d0c-41cb-bccc-11b716728e27": [0, 1],
            },
            "files_by_url": {},
        }

    def test_flat_file_index_remove_bundle(self):
        now = timezone.now()

        existing_json_index = {
            "bundles": [
                {
                    "bundle_id": f"artifact_bundle/{1234}",
                    "timestamp": (now - timedelta(hours=2)).isoformat(),
                },
                {
                    "bundle_id": f"artifact_bundle/{5678}",
                    "timestamp": (now - timedelta(hours=1)).isoformat(),
                },
                {"bundle_id": f"artifact_bundle/{9101112}", "timestamp": now.isoformat()},
            ],
            "files_by_debug_id": {
                "016ac8b3-60cb-427f-829c-7f99c92a6a95": [0],
                "2a9e7ab2-50ba-43b5-a8fd-13f6ac1f5976": [0, 1],
                "f206e0e7-3d0c-41cb-bccc-11b716728e27": [0, 1, 2],
                "de02ba67-6820-423f-a1b2-00c7e7d3bc9c": [1, 2],
                "c1e9ab1f-3745-44c8-be4b-aca3705c7c17": [2],
            },
        }

        flat_file_index = FlatFileIndex()
        flat_file_index.from_json(json.dumps(existing_json_index))
        flat_file_index.remove(5678)

        assert json.loads(flat_file_index.to_json()) == {
            "bundles": [
                {"bundle_id": f"artifact_bundle/{1234}", "timestamp": "2023-07-13T08:00:00+00:00"},
                {
                    "bundle_id": f"artifact_bundle/{9101112}",
                    "timestamp": "2023-07-13T10:00:00+00:00",
                },
            ],
            "files_by_debug_id": {
                "016ac8b3-60cb-427f-829c-7f99c92a6a95": [0],
                "2a9e7ab2-50ba-43b5-a8fd-13f6ac1f5976": [0],
                "f206e0e7-3d0c-41cb-bccc-11b716728e27": [0, 1],
                "de02ba67-6820-423f-a1b2-00c7e7d3bc9c": [1],
                "c1e9ab1f-3745-44c8-be4b-aca3705c7c17": [1],
            },
            "files_by_url": {},
        }

    def test_flat_file_index_with_index_stored_and_duplicated_bundle(self):
        existing_bundle_id = 0
        existing_bundle_date = timezone.now() - timedelta(hours=1)
        existing_json_index = {
            "bundles": [
                {
                    "bundle_id": f"artifact_bundle/{existing_bundle_id}",
                    "timestamp": existing_bundle_date.isoformat(),
                }
            ],
            "files_by_url": {"~/path/to/app.js": [0]},
        }

        artifact_bundle = self.mock_artifact_bundle(
            {
                "path/in/zip/foo": {
                    "url": "~/path/to/app.js",
                    "type": "minified_source",
                    "content": b"app_idx1",
                },
            }
        )

        with ArtifactBundleArchive(artifact_bundle.file.getfile()) as bundle_archive:
            flat_file_index = FlatFileIndex()
            flat_file_index.from_json(json.dumps(existing_json_index))
            # We use the id of the existing bundle.
            bundle_meta = BundleMeta(
                id=existing_bundle_id, timestamp=artifact_bundle.date_last_modified
            )
            flat_file_index.merge_urls(bundle_meta, bundle_archive)

        assert json.loads(flat_file_index.to_json()) == {
            "bundles": [
                {
                    "bundle_id": f"artifact_bundle/{existing_bundle_id}",
                    "timestamp": "2023-07-13T10:00:00+00:00",
                }
            ],
            "files_by_url": {"~/path/to/app.js": [0]},
            "files_by_debug_id": {},
        }
