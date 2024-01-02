import zipfile
from hashlib import sha1
from io import BytesIO

from django.core.files.base import ContentFile

from sentry.debug_files.artifact_bundles import get_redis_cluster_for_artifact_bundles
from sentry.models.artifactbundle import ArtifactBundle, ArtifactBundleIndex
from sentry.models.files.fileblob import FileBlob
from sentry.tasks.assemble import assemble_artifacts
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
        ).order_by("date_last_modified")
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
                "path/in/zip/baz": {
                    "url": "~/path/to/only1.js",
                    "content": b"only1_idx1",
                },
            }
        )
        with self.tasks():
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
        with self.tasks():
            upload_bundle(bundle, self.project, "1.0.0")

        # Uploading the same bundle a second time which internally still creates two artifact bundles, which both
        # cover the same set of files.

        bundles = get_artifact_bundles(self.project, "1.0.0")
        assert len(bundles) == 2
        indexed = get_indexed_files(self.project, "1.0.0", distinct=True)
        assert len(indexed) == 0

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
        with self.tasks():
            upload_bundle(bundle, self.project, "1.0.0")

        # the second upload will backfill everything that needs indexing
        bundles = get_artifact_bundles(self.project, "1.0.0")
        assert len(bundles) == 3
        indexed = get_indexed_files(self.project, "1.0.0", distinct=True)
        assert len(indexed) == 4

        # here, we use the more recent bundle for the shared file,
        # all other files are disjoint in this example
        assert indexed[0].url == "~/path/to/app.js"
        assert indexed[0].artifact_bundle == bundles[2]
        assert indexed[1].url == "~/path/to/only1.js"
        assert indexed[1].artifact_bundle == bundles[0]
        assert indexed[2].url == "~/path/to/other1.js"
        assert indexed[2].artifact_bundle == bundles[1]
        assert indexed[3].url == "~/path/to/other2.js"
        assert indexed[3].artifact_bundle == bundles[2]
