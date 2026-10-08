import uuid
import zipfile
from datetime import datetime, timedelta
from hashlib import sha1
from io import BytesIO
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.db import connections, router
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from sentry.debug_files.artifact_bundles import (
    get_artifact_bundles_containing_debug_id,
    get_artifact_bundles_containing_url,
    get_bundles_indexing_state,
    get_cached_bundles_indexing_state,
    get_redis_cluster_for_artifact_bundles,
    index_urls_in_bundle,
    query_artifact_bundles_containing_file,
    renew_artifact_bundle,
)
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleArchive,
    ArtifactBundleIndex,
    ArtifactBundleIndexingState,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
    SourceFileType,
)
from sentry.models.files.fileblob import FileBlob
from sentry.models.project import Project
from sentry.tasks.assemble import assemble_artifacts
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
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
    blob1 = FileBlob.from_file_with_organization(ContentFile(bundle_file), project.organization)
    total_checksum = sha1(bundle_file).hexdigest()

    return assemble_artifacts(
        org_id=project.organization.id,
        project_ids=[project.id],
        version=release,
        dist=dist,
        checksum=total_checksum,
        chunks=[blob1.checksum],
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
    ).order_by("url", "-artifact_bundle__date_last_modified")
    if distinct:
        query = query.distinct("url")
    return list(query)


class ArtifactLookupTest(TestCase):
    def clear_cache(self):
        redis_client = get_redis_cluster_for_artifact_bundles()
        redis_client.flushall()

    def test_indexing_artifacts(self) -> None:
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

    @override_options({"sourcemaps.artifact-bundles.indexing-state-cache-ttl": 60})
    def test_indexing_artifacts_with_cached_indexing_state(self) -> None:
        self.clear_cache()

        for i in range(4):
            bundle = make_compressed_zip_file(
                {
                    "path/in/zip/foo": {
                        "url": f"~/path/to/app{i}.js",
                        "content": f"app_idx{i}".encode(),
                    },
                }
            )
            with self.tasks():
                upload_bundle(bundle, self.project, "1.0.0")

        # Counts below the threshold are not cached, so the third upload still indexes and
        # backfills the release, and the fourth one is indexed using the cached counts.
        assert len(get_artifact_bundles(self.project, "1.0.0")) == 4
        assert len(get_indexed_files(self.project, "1.0.0")) == 4
        assert get_bundles_indexing_state(self.organization, "1.0.0", "") == (4, 4)


class GetCachedBundlesIndexingStateTest(TestCase):
    def setUp(self) -> None:
        get_redis_cluster_for_artifact_bundles().flushall()

    def create_bundles(self, count: int) -> None:
        for _ in range(count):
            artifact_bundle = self.create_artifact_bundle(
                artifact_count=1,
                indexing_state=ArtifactBundleIndexingState.NOT_INDEXED.value,
            )
            ReleaseArtifactBundle.objects.create(
                organization_id=self.organization.id,
                artifact_bundle=artifact_bundle,
                release_name="1.0.0",
                dist_name="",
            )

    def test_not_cached_by_default(self) -> None:
        self.create_bundles(3)
        assert get_cached_bundles_indexing_state(self.organization, "1.0.0", "") == (3, 0)

        self.create_bundles(1)
        assert get_cached_bundles_indexing_state(self.organization, "1.0.0", "") == (4, 0)

    @override_options({"sourcemaps.artifact-bundles.indexing-state-cache-ttl": 60})
    def test_cached_from_threshold(self) -> None:
        self.create_bundles(3)
        assert get_cached_bundles_indexing_state(self.organization, "1.0.0", "") == (3, 0)

        self.create_bundles(1)
        assert get_cached_bundles_indexing_state(self.organization, "1.0.0", "") == (3, 0)
        # Other releases and dists are cached separately.
        assert get_cached_bundles_indexing_state(self.organization, "1.0.0", "dist") == (0, 0)
        assert get_cached_bundles_indexing_state(self.organization, "2.0.0", "") == (0, 0)

    @override_options({"sourcemaps.artifact-bundles.indexing-state-cache-ttl": 60})
    def test_not_cached_below_threshold(self) -> None:
        self.create_bundles(2)
        assert get_cached_bundles_indexing_state(self.organization, "1.0.0", "") == (2, 0)

        self.create_bundles(1)
        assert get_cached_bundles_indexing_state(self.organization, "1.0.0", "") == (3, 0)


class QueryArtifactBundlesContainingFileTest(TestCase):
    def setUp(self) -> None:
        self.release_name = "1.0.0"
        self.dist_name = ""

    def create_bundle(self, indexed: bool, urls: tuple[str, ...] = ()) -> ArtifactBundle:
        indexing_state = (
            ArtifactBundleIndexingState.WAS_INDEXED
            if indexed
            else ArtifactBundleIndexingState.NOT_INDEXED
        )
        artifact_bundle = self.create_artifact_bundle(
            artifact_count=max(len(urls), 1),
            indexing_state=indexing_state.value,
            date_last_modified=timezone.now(),
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=artifact_bundle,
            release_name=self.release_name,
            dist_name=self.dist_name,
        )
        if indexed:
            for url in urls:
                ArtifactBundleIndex.objects.create(
                    organization_id=self.organization.id,
                    artifact_bundle=artifact_bundle,
                    url=url,
                    date_added=artifact_bundle.date_added,
                )
        return artifact_bundle

    def query(self, url: str) -> set[tuple[int, str]]:
        return set(
            query_artifact_bundles_containing_file(
                self.project, self.release_name, self.dist_name, url, None
            )
        )

    @override_options({"sourcemaps.artifact-bundles.bounded-indexing-state": True})
    def test_bounded_indexing_state_without_bundles(self) -> None:
        self.create_bundle(indexed=False)

        assert self.query("/path/to/app") != set()
        self.release_name = "2.0.0"
        assert self.query("/path/to/app") == set()

    @override_options({"sourcemaps.artifact-bundles.bounded-indexing-state": True})
    def test_bounded_indexing_state_below_threshold(self) -> None:
        bundle1 = self.create_bundle(indexed=False)
        bundle2 = self.create_bundle(indexed=False)

        assert self.query("/path/to/app") == {(bundle1.id, "release"), (bundle2.id, "release")}

    @override_options({"sourcemaps.artifact-bundles.bounded-indexing-state": True})
    def test_bounded_indexing_state_fully_indexed(self) -> None:
        bundle1 = self.create_bundle(indexed=True, urls=("~/path/to/app.js",))
        self.create_bundle(indexed=True, urls=("~/path/to/other.js",))
        self.create_bundle(indexed=True, urls=("~/path/to/third.js",))

        with patch(
            "sentry.debug_files.artifact_bundles.get_bundles_indexing_state"
        ) as indexing_state:
            assert self.query("/path/to/app") == {(bundle1.id, "index")}
            assert self.query("/path/to/missing") == set()
        assert not indexing_state.called

    @override_options({"sourcemaps.artifact-bundles.bounded-indexing-state": True})
    def test_bounded_indexing_state_newest_bundle_not_indexed(self) -> None:
        bundle1 = self.create_bundle(indexed=True, urls=("~/path/to/app.js",))
        bundle2 = self.create_bundle(indexed=True, urls=("~/path/to/other.js",))
        bundle3 = self.create_bundle(indexed=True, urls=("~/path/to/third.js",))
        bundle4 = self.create_bundle(indexed=False)

        # The newest bundles are added, and the index match takes precedence.
        assert self.query("/path/to/app") == {
            (bundle1.id, "index"),
            (bundle2.id, "release"),
            (bundle3.id, "release"),
            (bundle4.id, "release"),
        }

    @override_options({"sourcemaps.artifact-bundles.bounded-indexing-state": True})
    def test_bounded_indexing_state_ignores_older_unindexed_bundles(self) -> None:
        self.create_bundle(indexed=False)
        newer = [self.create_bundle(indexed=True, urls=(f"~/path/to/app{i}.js",)) for i in range(5)]

        # The unindexed bundle is older than the five newest ones, which the full count would
        # have added although they are indexed.
        assert self.query("/path/to/app3") == {(newer[3].id, "index")}

    def test_full_count_by_default(self) -> None:
        self.create_bundle(indexed=False)
        newer = [self.create_bundle(indexed=True, urls=(f"~/path/to/app{i}.js",)) for i in range(5)]

        assert self.query("/path/to/app3") == {
            (newer[0].id, "release"),
            (newer[1].id, "release"),
            (newer[2].id, "release"),
            (newer[3].id, "index"),
            (newer[4].id, "release"),
        }


class IndexUrlsInBundleTest(TestCase):
    debug_id = "eb6e60f1-65ff-4f6f-adff-f1bbeded627b"

    def index(self) -> list[str]:
        files = {
            "files/_/_/generated.js": {
                "url": f"~/{self.debug_id}-0.js",
                "type": "minified_source",
                "content": b"generated",
                "headers": {"debug-id": self.debug_id},
            },
            "files/_/_/generated.js.map": {
                "url": f"~/{self.debug_id.upper()}-0.js.map",
                "type": "source_map",
                "content": b"generated_map",
                "headers": {"Debug-Id": self.debug_id.upper()},
            },
            "files/_/_/app.js": {
                "url": "~/static/js/app.js",
                "type": "minified_source",
                "content": b"app",
                "headers": {"debug-id": self.debug_id},
            },
            "files/_/_/other.js": {
                "url": f"~/{self.debug_id}-1.js",
                "type": "minified_source",
                "content": b"other",
                "headers": {"debug-id": "aaaaaaaa-0000-0000-0000-000000000000"},
            },
            "files/_/_/plain.js": {
                "url": f"~/{self.debug_id}-2.js",
                "type": "minified_source",
                "content": b"plain",
            },
        }
        artifact_bundle = self.create_artifact_bundle(artifact_count=len(files))
        with ArtifactBundleArchive(BytesIO(make_compressed_zip_file(files))) as archive:
            index_urls_in_bundle(self.organization.id, artifact_bundle, archive)

        artifact_bundle.refresh_from_db()
        assert artifact_bundle.indexing_state == ArtifactBundleIndexingState.WAS_INDEXED.value
        return sorted(
            ArtifactBundleIndex.objects.filter(artifact_bundle=artifact_bundle).values_list(
                "url", flat=True
            )
        )

    def test_indexes_all_urls_by_default(self) -> None:
        assert self.index() == [
            f"~/{self.debug_id.upper()}-0.js.map",
            f"~/{self.debug_id}-0.js",
            f"~/{self.debug_id}-1.js",
            f"~/{self.debug_id}-2.js",
            "~/static/js/app.js",
        ]

    @override_options({"sourcemaps.artifact-bundles.index-skip-debug-id-names": True})
    def test_skips_files_named_after_their_debug_id(self) -> None:
        # Only files whose own debug ID starts their name are skipped.
        assert self.index() == [
            f"~/{self.debug_id}-1.js",
            f"~/{self.debug_id}-2.js",
            "~/static/js/app.js",
        ]


class GetArtifactBundlesContainingUrlTest(TestCase):
    def setUp(self) -> None:
        self.release_name = "1.0.0"
        self.dist_name = "dist1"

    def create_bundle(self, date_added=None, date_last_modified=None):
        if date_added is None:
            date_added = timezone.now()
        if date_last_modified is None:
            date_last_modified = date_added

        file = self.create_file(name="bundle.zip")
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            bundle_id=uuid.uuid4(),
            file=file,
            artifact_count=5,
            date_added=date_added,
            date_uploaded=date_added,
            date_last_modified=date_last_modified,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
            date_added=date_added,
        )

        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=artifact_bundle,
            release_name=self.release_name,
            dist_name=self.dist_name,
            date_added=date_added,
        )
        return artifact_bundle

    def assert_results(self, results: set[tuple[int, datetime]], expected_bundle_ids: set[int]):
        assert {bundle_id for bundle_id, _ in results} == expected_bundle_ids

    def test_get_artifact_bundles_containing_url_exact_match(self) -> None:
        """Test retrieving a bundle with an exact URL match."""
        bundle = self.create_bundle()
        url = "http://example.com/file.js"

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle,
            url=url,
            date_added=bundle.date_added,
        )
        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, url
            ),
            {bundle.id},
        )

    def test_get_artifact_bundles_containing_url_suffix_match(self) -> None:
        """Test retrieving a bundle with a URL suffix match."""
        bundle = self.create_bundle()
        full_url = "http://example.com/path/to/file.js"
        search_url = "file.js"

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle,
            url=full_url,
            date_added=bundle.date_added,
        )
        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, search_url
            ),
            {bundle.id},
        )

    def test_get_artifact_bundles_containing_url_no_match(self) -> None:
        """Test retrieving bundles when none match the URL."""
        bundle = self.create_bundle()
        url = "http://example.com/file.js"
        search_url = "nonexistent.js"

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle,
            url=url,
            date_added=bundle.date_added,
        )

        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, search_url
            ),
            set(),
        )

    def test_get_artifact_bundles_containing_url_multiple_matches(self) -> None:
        """Test retrieving multiple bundles with the same URL."""
        # Create bundles with different timestamps
        bundle1 = self.create_bundle(
            date_added=timezone.now() - timedelta(days=2),
            date_last_modified=timezone.now() - timedelta(days=2),
        )
        bundle2 = self.create_bundle(
            date_added=timezone.now() - timedelta(days=1),
            date_last_modified=timezone.now() - timedelta(days=1),
        )
        bundle3 = self.create_bundle()  # Most recent

        url = "http://example.com/file.js"

        # Create index entries for the URL in all bundles
        for bundle in [bundle1, bundle2, bundle3]:
            ArtifactBundleIndex.objects.create(
                organization_id=self.organization.id,
                artifact_bundle=bundle,
                url=url,
                date_added=bundle.date_added,
            )

        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, url
            ),
            {bundle3.id, bundle2.id, bundle1.id},
        )

    def test_get_artifact_bundles_containing_url_different_project(self) -> None:
        """Test that bundles from a different project are not returned."""
        bundle = self.create_bundle()
        url = "http://example.com/file.js"
        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle,
            url=url,
            date_added=bundle.date_added,
        )
        other_project = self.create_project(organization=self.organization)
        self.assert_results(
            get_artifact_bundles_containing_url(
                other_project, self.release_name, self.dist_name, url
            ),
            set(),
        )

    def test_get_artifact_bundles_containing_url_different_release(self) -> None:
        """Test that bundles from a different release are not returned."""
        bundle = self.create_bundle()
        url = "http://example.com/file.js"
        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle,
            url=url,
            date_added=bundle.date_added,
        )
        self.assert_results(
            get_artifact_bundles_containing_url(self.project, "2.0.0", self.dist_name, url),
            set(),
        )

    def test_contains(self) -> None:
        """
        Test that demonstrates why we use reversed_url__istartswith instead of contains.
        A 'contains' query would match parts of filenames anywhere, but we want to match
        only suffix patterns.
        """
        bundle = self.create_bundle()
        url = "http://example.com/path/with/file.js/in/deeper/directory/index.html"
        search_string = "file.js"

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle,
            url=url,
            date_added=bundle.date_added,
        )

        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, search_string
            ),
            {bundle.id},
        )

        bundle2 = self.create_bundle()
        url2 = "http://example.com/path/to/file.js"

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle2,
            url=url2,
            date_added=bundle2.date_added,
        )

        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, search_string
            ),
            {bundle.id, bundle2.id},
        )

    def test_case_insensitive_url_matching(self) -> None:
        """Test that URLs with different casing match properly."""
        bundle = self.create_bundle()
        url = "http://example.com/path/to/CamelCaseFile.js"

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle,
            url=url,
            date_added=bundle.date_added,
        )
        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, "camelcasefile.js"
            ),
            {bundle.id},
        )
        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, "CAMELCASEFILE.JS"
            ),
            {bundle.id},
        )
        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, "cAmElCaSeFilE.Js"
            ),
            {bundle.id},
        )

    def test_multiple_bundles_with_different_urls(self) -> None:
        """Test that when we have multiple bundles with different URLs, we match to only one."""
        bundle1 = self.create_bundle()
        bundle2 = self.create_bundle()
        bundle3 = self.create_bundle()

        url1 = "http://example.com/path/to/file1.js"
        url2 = "http://example.com/path/to/file2.js"
        url3 = "http://example.com/path/to/file3.js"

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle1,
            url=url1,
            date_added=bundle1.date_added,
        )
        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle2,
            url=url2,
            date_added=bundle2.date_added,
        )
        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle3,
            url=url3,
            date_added=bundle3.date_added,
        )
        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, "file1.js"
            ),
            {bundle1.id},
        )
        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, "file2.js"
            ),
            {bundle2.id},
        )
        self.assert_results(
            get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, "file3.js"
            ),
            {bundle3.id},
        )

    def index_url(self, bundle: ArtifactBundle, url: str) -> None:
        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=bundle,
            url=url,
            date_added=bundle.date_added,
        )

    def lookup(self, url: str) -> set[int]:
        return {
            bundle_id
            for bundle_id, _ in get_artifact_bundles_containing_url(
                self.project, self.release_name, self.dist_name, url
            )
        }

    @override_options({"sourcemaps.artifact-bundles.url-lookup.max-index-rows": 1000})
    def test_url_lookup_budget_scans_small_release_completely(self) -> None:
        old = self.create_bundle(date_added=timezone.now() - timedelta(days=90))
        new = self.create_bundle()
        self.index_url(old, "~/path/to/old.js")
        self.index_url(new, "~/path/to/new.js")

        assert self.lookup("/path/to/old") == {old.id}
        assert self.lookup("/path/to/new") == {new.id}

    @override_options(
        {
            # Each bundle has 5 files, so the budget covers two bundles.
            "sourcemaps.artifact-bundles.url-lookup.max-index-rows": 10,
            "system.debug-files-renewal-age-threshold-days": 7,
            "sourcemaps.artifact-bundles.url-lookup.active-margin-days": 7,
        }
    )
    def test_url_lookup_budget_prefers_active_bundles(self) -> None:
        now = timezone.now()
        renewed = self.create_bundle(
            date_added=now - timedelta(days=3), date_last_modified=now - timedelta(days=60)
        )
        idle = self.create_bundle(date_added=now - timedelta(days=50))
        newest = self.create_bundle()
        self.index_url(renewed, "~/path/to/renewed.js")
        self.index_url(idle, "~/path/to/idle.js")
        self.index_url(newest, "~/path/to/newest.js")

        # `idle` was uploaded after `renewed`, but only the active bundles fit in the budget.
        assert self.lookup("/path/to/renewed") == {renewed.id}
        assert self.lookup("/path/to/newest") == {newest.id}
        assert self.lookup("/path/to/idle") == set()

    @override_options(
        {
            "sourcemaps.artifact-bundles.url-lookup.max-index-rows": 10,
            "system.debug-files-renewal-age-threshold-days": 7,
            "sourcemaps.artifact-bundles.url-lookup.active-margin-days": 7,
        }
    )
    def test_url_lookup_budget_uses_newest_idle_bundles(self) -> None:
        now = timezone.now()
        oldest = self.create_bundle(date_added=now - timedelta(days=90))
        older = self.create_bundle(date_added=now - timedelta(days=80))
        newer = self.create_bundle(date_added=now - timedelta(days=70))
        for bundle, name in ((oldest, "oldest"), (older, "older"), (newer, "newer")):
            self.index_url(bundle, f"~/path/to/{name}.js")

        # Without active bundles, the budget goes to the most recently uploaded bundles.
        assert self.lookup("/path/to/newer") == {newer.id}
        assert self.lookup("/path/to/older") == {older.id}
        assert self.lookup("/path/to/oldest") == set()

    @override_options({"sourcemaps.artifact-bundles.url-lookup.max-index-rows": 1})
    def test_url_lookup_budget_scans_at_least_one_bundle(self) -> None:
        older = self.create_bundle()
        newer = self.create_bundle()
        self.index_url(older, "~/path/to/app.js")
        self.index_url(newer, "~/path/to/app.js")

        assert self.lookup("/path/to/app") == {newer.id}

    @override_options({"sourcemaps.artifact-bundles.url-lookup.max-index-rows": 1000})
    def test_url_lookup_budget_respects_project_and_release(self) -> None:
        bundle = self.create_bundle()
        self.index_url(bundle, "~/path/to/app.js")

        other_project = self.create_project(organization=self.organization)
        assert (
            get_artifact_bundles_containing_url(
                other_project, self.release_name, self.dist_name, "/path/to/app"
            )
            == set()
        )
        assert (
            get_artifact_bundles_containing_url(
                self.project, "2.0.0", self.dist_name, "/path/to/app"
            )
            == set()
        )
        assert self.lookup("/path/to/app") == {bundle.id}

    @override_options(
        {
            "sourcemaps.artifact-bundles.url-lookup.max-index-rows": 1000,
            "sourcemaps.artifact-bundles.url-lookup.max-candidate-bundles": 2,
        }
    )
    def test_url_lookup_candidate_cap(self) -> None:
        oldest = self.create_bundle()
        older = self.create_bundle()
        newest = self.create_bundle()
        for bundle, name in ((oldest, "oldest"), (older, "older"), (newest, "newest")):
            self.index_url(bundle, f"~/path/to/{name}.js")

        # The budget covers all three bundles, but the lookup reads only the two newest.
        assert self.lookup("/path/to/newest") == {newest.id}
        assert self.lookup("/path/to/older") == {older.id}
        assert self.lookup("/path/to/oldest") == set()

    @override_options(
        {
            "sourcemaps.artifact-bundles.url-lookup.max-index-rows": 1000,
            "sourcemaps.artifact-bundles.url-lookup.max-candidate-bundles": 2,
            "system.debug-files-renewal-age-threshold-days": 7,
            "sourcemaps.artifact-bundles.url-lookup.active-margin-days": 7,
        }
    )
    def test_url_lookup_candidate_cap_reaches_idle_bundles(self) -> None:
        idle = self.create_bundle(date_added=timezone.now() - timedelta(days=50))
        older = self.create_bundle()
        newer = self.create_bundle()
        for bundle, name in ((idle, "idle"), (older, "older"), (newer, "newer")):
            self.index_url(bundle, f"~/path/to/{name}.js")

        with patch("sentry.debug_files.artifact_bundles.metrics") as metrics:
            # There are exactly as many active bundles as the cap, so the idle one is scanned too.
            assert self.lookup("/path/to/idle") == {idle.id}

        metrics.incr.assert_any_call(
            "artifact_bundle_url_lookup.candidates", tags={"truncated": "false"}
        )

    @override_options(
        {
            "sourcemaps.artifact-bundles.url-lookup.max-index-rows": 1000,
            "sourcemaps.artifact-bundles.url-lookup.max-candidate-bundles": 0,
        }
    )
    def test_url_lookup_candidate_cap_reads_at_least_one_bundle(self) -> None:
        older = self.create_bundle()
        newer = self.create_bundle()
        self.index_url(older, "~/path/to/app.js")
        self.index_url(newer, "~/path/to/app.js")

        assert self.lookup("/path/to/app") == {newer.id}

    @override_options(
        {
            # Each bundle has 5 files, so the budget covers two bundles.
            "sourcemaps.artifact-bundles.url-lookup.max-index-rows": 10,
            "sourcemaps.artifact-bundles.url-lookup.truncated-log-sample-rate": 1.0,
        }
    )
    def test_url_lookup_truncated_by_budget_is_logged(self) -> None:
        for _ in range(3):
            self.create_bundle()

        with (
            patch("sentry.debug_files.artifact_bundles.metrics") as metrics,
            patch("sentry.debug_files.artifact_bundles.logger") as logger,
        ):
            self.lookup("/path/to/app")

        metrics.incr.assert_any_call(
            "artifact_bundle_url_lookup.candidates", tags={"truncated": "budget"}
        )
        logger.info.assert_called_once_with(
            "artifact_bundle_url_lookup.truncated",
            extra={
                "organization_id": self.organization.id,
                "project_id": self.project.id,
                "release": self.release_name,
                "dist": self.dist_name,
                "truncated_by": "budget",
                "max_index_rows": 10,
                "max_candidate_bundles": 1000,
                "index_rows": 10,
                "candidates": 2,
            },
        )

    @override_options(
        {
            "sourcemaps.artifact-bundles.url-lookup.max-index-rows": 1000,
            "sourcemaps.artifact-bundles.url-lookup.max-candidate-bundles": 2,
            "sourcemaps.artifact-bundles.url-lookup.truncated-log-sample-rate": 0.0,
        }
    )
    def test_url_lookup_truncated_by_candidate_cap(self) -> None:
        for _ in range(3):
            self.create_bundle()

        with (
            patch("sentry.debug_files.artifact_bundles.metrics") as metrics,
            patch("sentry.debug_files.artifact_bundles.logger") as logger,
        ):
            self.lookup("/path/to/app")

        metrics.incr.assert_any_call(
            "artifact_bundle_url_lookup.candidates", tags={"truncated": "candidates"}
        )
        # Not sampled.
        logger.info.assert_not_called()

    @override_options(
        {
            "sourcemaps.artifact-bundles.url-lookup.max-index-rows": 1000,
            "sourcemaps.artifact-bundles.url-lookup.truncated-log-sample-rate": 1.0,
        }
    )
    def test_url_lookup_not_truncated(self) -> None:
        self.create_bundle()

        with (
            patch("sentry.debug_files.artifact_bundles.metrics") as metrics,
            patch("sentry.debug_files.artifact_bundles.logger") as logger,
        ):
            self.lookup("/path/to/app")

        metrics.incr.assert_any_call(
            "artifact_bundle_url_lookup.candidates", tags={"truncated": "false"}
        )
        logger.info.assert_not_called()


class GetArtifactBundlesContainingDebugIdTest(TestCase):
    def setUp(self) -> None:
        self.debug_id = str(uuid.uuid4())

    def create_bundle(
        self,
        debug_ids: tuple[str, ...],
        project: Project | None = None,
        date_last_modified: datetime | None = None,
    ) -> ArtifactBundle:
        project = project or self.project
        date_added = timezone.now()
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=project.organization_id,
            bundle_id=uuid.uuid4(),
            file=self.create_file(name="bundle.zip"),
            artifact_count=2,
            date_added=date_added,
            date_uploaded=date_added,
            date_last_modified=date_last_modified or date_added,
        )
        ProjectArtifactBundle.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            artifact_bundle=artifact_bundle,
            date_added=date_added,
        )
        for debug_id in debug_ids:
            # A minified file and its source map share a debug ID.
            for source_file_type in (SourceFileType.MINIFIED_SOURCE, SourceFileType.SOURCE_MAP):
                DebugIdArtifactBundle.objects.create(
                    organization_id=project.organization_id,
                    debug_id=debug_id,
                    artifact_bundle=artifact_bundle,
                    source_file_type=source_file_type.value,
                    date_added=date_added,
                )
        return artifact_bundle

    def lookup(self) -> tuple[set[int], list[set[str]]]:
        """
        Returns the ids of the bundles found, and the artifact bundle tables that each query read.
        """
        tables = (
            "sentry_artifactbundle",
            "sentry_debugidartifactbundle",
            "sentry_projectartifactbundle",
        )
        with CaptureQueriesContext(
            connections[router.db_for_read(ArtifactBundle)]
        ) as captured_queries:
            bundles = get_artifact_bundles_containing_debug_id(self.project, self.debug_id)

        queries = [
            {table for table in tables if f'"{table}"' in query["sql"]}
            for query in captured_queries.captured_queries
        ]
        return {bundle_id for bundle_id, _date_added in bundles}, [q for q in queries if q]

    def test_returns_most_recently_modified_bundle_of_project(self) -> None:
        now = timezone.now()
        modified_last = self.create_bundle(
            (self.debug_id,), date_last_modified=now - timedelta(hours=1)
        )
        # Uploaded after `modified_last`, which was then uploaded again.
        self.create_bundle((self.debug_id,), date_last_modified=now - timedelta(hours=2))
        # Newer bundles without the debug ID, or of another project or organization.
        self.create_bundle((str(uuid.uuid4()),))
        self.create_bundle(
            (self.debug_id,), project=self.create_project(organization=self.organization)
        )
        other_organization = self.create_organization()
        self.create_bundle(
            (self.debug_id,),
            project=self.create_project(
                organization=other_organization,
                teams=[self.create_team(organization=other_organization)],
            ),
        )

        for max_rows in (0, 1000):
            with override_options(
                {"sourcemaps.artifact-bundles.debug-id-lookup.max-rows": max_rows}
            ):
                assert self.lookup()[0] == {modified_last.id}

    def test_joins_all_tables_by_default(self) -> None:
        bundle = self.create_bundle((self.debug_id,))

        assert self.lookup() == (
            {bundle.id},
            [
                {
                    "sentry_artifactbundle",
                    "sentry_debugidartifactbundle",
                    "sentry_projectartifactbundle",
                }
            ],
        )

    @override_options({"sourcemaps.artifact-bundles.debug-id-lookup.max-rows": 1000})
    def test_reads_debug_id_rows_first(self) -> None:
        bundle = self.create_bundle((self.debug_id,))

        with patch("sentry.debug_files.artifact_bundles.metrics") as metrics:
            # No query joins the debug-ID rows with the project's bundles.
            assert self.lookup() == (
                {bundle.id},
                [
                    {"sentry_debugidartifactbundle"},
                    {"sentry_projectartifactbundle"},
                    {"sentry_artifactbundle"},
                ],
            )

        metrics.incr.assert_any_call(
            "artifact_bundle_debug_id_lookup.rows", tags={"truncated": "false"}
        )

    @override_options({"sourcemaps.artifact-bundles.debug-id-lookup.max-rows": 1000})
    def test_debug_id_not_uploaded(self) -> None:
        self.create_bundle((str(uuid.uuid4()),))

        assert self.lookup() == (set(), [{"sentry_debugidartifactbundle"}])

    @override_options({"sourcemaps.artifact-bundles.debug-id-lookup.max-rows": 1000})
    def test_debug_id_of_another_project(self) -> None:
        self.create_bundle(
            (self.debug_id,), project=self.create_project(organization=self.organization)
        )

        assert self.lookup() == (
            set(),
            [{"sentry_debugidartifactbundle"}, {"sentry_projectartifactbundle"}],
        )

    @override_options({"sourcemaps.artifact-bundles.debug-id-lookup.max-rows": 1})
    def test_debug_id_with_more_rows_joins_all_tables(self) -> None:
        # The bundle has two rows for the debug ID, one more than we read.
        bundle = self.create_bundle((self.debug_id,))

        with patch("sentry.debug_files.artifact_bundles.metrics") as metrics:
            assert self.lookup() == (
                {bundle.id},
                [
                    {"sentry_debugidartifactbundle"},
                    {
                        "sentry_artifactbundle",
                        "sentry_debugidartifactbundle",
                        "sentry_projectartifactbundle",
                    },
                ],
            )

        metrics.incr.assert_any_call(
            "artifact_bundle_debug_id_lookup.rows", tags={"truncated": "true"}
        )

    @override_options({"sourcemaps.artifact-bundles.debug-id-lookup.max-rows": 1000})
    def test_query_artifact_bundles_containing_file(self) -> None:
        bundle = self.create_bundle((self.debug_id,))

        assert query_artifact_bundles_containing_file(
            self.project, "1.0.0", "", "/path/to/app", self.debug_id
        ) == [(bundle.id, "debug-id")]


class RenewArtifactBundleTest(TestCase):
    def setUp(self) -> None:
        self.old_date = timezone.now() - timedelta(days=60)
        self.artifact_bundle = self.create_artifact_bundle(self.organization, artifact_count=1)
        ArtifactBundle.objects.filter(id=self.artifact_bundle.id).update(date_added=self.old_date)
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=self.artifact_bundle,
            date_added=self.old_date,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="1.0",
            dist_name="",
            artifact_bundle=self.artifact_bundle,
            date_added=self.old_date,
        )
        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id=uuid.uuid4(),
            artifact_bundle=self.artifact_bundle,
            source_file_type=SourceFileType.MINIFIED_SOURCE.value,
            date_added=self.old_date,
        )
        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=self.artifact_bundle,
            url="~/path/to/app.js",
            date_added=self.old_date,
        )

    def renew(self) -> datetime:
        now = timezone.now()
        renew_artifact_bundle(self.artifact_bundle.id, now - timedelta(days=30), now)
        return now

    def linked_dates(self) -> set[datetime]:
        bundle_id = self.artifact_bundle.id
        return {
            ProjectArtifactBundle.objects.get(artifact_bundle_id=bundle_id).date_added,
            ReleaseArtifactBundle.objects.get(artifact_bundle_id=bundle_id).date_added,
            DebugIdArtifactBundle.objects.get(artifact_bundle_id=bundle_id).date_added,
            ArtifactBundleIndex.objects.get(artifact_bundle_id=bundle_id).date_added,
        }

    def test_renews_bundle_and_linked_rows(self) -> None:
        now = self.renew()

        assert ArtifactBundle.objects.get(id=self.artifact_bundle.id).date_added == now
        assert self.linked_dates() == {now}

    @override_options({"sourcemaps.artifact-bundles.date-only-on-bundle": True})
    def test_renews_only_the_bundle_with_date_only_on_bundle(self) -> None:
        now = self.renew()

        assert ArtifactBundle.objects.get(id=self.artifact_bundle.id).date_added == now
        assert self.linked_dates() == {self.old_date}
