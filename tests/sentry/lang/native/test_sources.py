from typing import Optional

from django.utils import timezone

from sentry.debug_files.artifact_bundle_indexing import FlatFileIdentifier, FlatFileMeta
from sentry.debug_files.artifact_bundles import get_redis_cluster_for_artifact_bundles
from sentry.lang.native.sources import get_bundle_index_urls
from sentry.models.artifactbundle import ArtifactBundleFlatFileIndex
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all


def _mock_flat_file_index(
    project_id: int, release: Optional[str], dist: Optional[str]
) -> ArtifactBundleFlatFileIndex:
    index = ArtifactBundleFlatFileIndex.objects.create(
        project_id=project_id,
        release_name=release or "",
        dist_name=dist or "",
    )
    index.update_flat_file_index("{}")

    return index


def _clear_cache():
    redis_client = get_redis_cluster_for_artifact_bundles()
    redis_client.flushall()


@django_db_all
@freeze_time("2023-07-26T10:00:00")
@override_options({"symbolicator.sourcemaps-bundle-index-sample-rate": 0.0})
def test_get_bundle_index_urls_with_no_zero_sample_rate(default_project):
    release = "1.0"
    dist = "android"

    # We want to create both indexes to show that still we get no data back.
    _mock_flat_file_index(project_id=default_project.id, release=release, dist=dist)
    _mock_flat_file_index(project_id=default_project.id, release=None, dist=None)

    debug_id_index, url_index = get_bundle_index_urls(
        project=default_project, release=release, dist=dist
    )

    assert debug_id_index is None
    assert url_index is None


@django_db_all
@freeze_time("2023-07-26T10:00:00")
@override_options({"symbolicator.sourcemaps-bundle-index-sample-rate": 1.0})
def test_get_bundle_index_urls_with_no_cached_values(default_project):
    release = "1.0"
    dist = "android"

    # We test with no data.
    debug_id_index, url_index = get_bundle_index_urls(
        project=default_project, release=release, dist=dist
    )

    assert debug_id_index is None
    assert url_index is None
    assert (
        FlatFileIdentifier(
            project_id=default_project.id, release=release, dist=dist
        ).get_flat_file_meta_from_cache()
        == FlatFileMeta.build_none()
    )

    _clear_cache()

    index_1 = _mock_flat_file_index(project_id=default_project.id, release=release, dist=dist)

    # We test the generation with release only.
    debug_id_index, url_index = get_bundle_index_urls(
        project=default_project, release=release, dist=dist
    )

    assert debug_id_index is None
    assert (
        url_index
        == f"http://testserver/api/0/projects/baz/bar/artifact-lookup/?download=bundle_index/{index_1.id}/1690365600000"
    )
    assert (
        FlatFileIdentifier(
            project_id=default_project.id, release=release, dist=dist
        ).get_flat_file_meta_from_cache()
        is not None
    )

    _clear_cache()

    index_2 = _mock_flat_file_index(project_id=default_project.id, release=None, dist=None)

    # We test the generation with debug id only.
    debug_id_index, url_index = get_bundle_index_urls(
        project=default_project, release=None, dist=None
    )

    assert (
        debug_id_index
        == f"http://testserver/api/0/projects/baz/bar/artifact-lookup/?download=bundle_index/{index_2.id}/1690365600000"
    )
    assert url_index is None
    assert (
        FlatFileIdentifier.for_debug_id(
            project_id=default_project.id
        ).get_flat_file_meta_from_cache()
        is not None
    )

    _clear_cache()

    # We test the generation with release and debug id.
    debug_id_index, url_index = get_bundle_index_urls(
        project=default_project, release=release, dist=dist
    )

    assert (
        debug_id_index
        == f"http://testserver/api/0/projects/baz/bar/artifact-lookup/?download=bundle_index/{index_2.id}/1690365600000"
    )
    assert (
        url_index
        == f"http://testserver/api/0/projects/baz/bar/artifact-lookup/?download=bundle_index/{index_1.id}/1690365600000"
    )
    assert (
        FlatFileIdentifier(
            project_id=default_project.id, release=release, dist=dist
        ).get_flat_file_meta_from_cache()
        is not None
    )
    assert (
        FlatFileIdentifier.for_debug_id(
            project_id=default_project.id
        ).get_flat_file_meta_from_cache()
        is not None
    )


@django_db_all
@freeze_time("2023-07-26T10:00:00")
@override_options({"symbolicator.sourcemaps-bundle-index-sample-rate": 1.0})
def test_get_bundle_index_urls_with_cached_values(default_project):
    release = "1.0"
    dist = "android"

    # A cached value for debug id identifier.
    meta_debug_id = FlatFileMeta(id=1, date=timezone.now())
    FlatFileIdentifier.for_debug_id(project_id=default_project.id).set_flat_file_meta_in_cache(
        flat_file_meta=meta_debug_id
    )

    # A cached value for release identifier.
    meta_release = FlatFileMeta(id=2, date=timezone.now())
    FlatFileIdentifier(
        project_id=default_project.id, release=release, dist=dist
    ).set_flat_file_meta_in_cache(flat_file_meta=meta_release)

    debug_id_index, url_index = get_bundle_index_urls(
        project=default_project, release=release, dist=dist
    )
    assert (
        debug_id_index
        == f"http://testserver/api/0/projects/baz/bar/artifact-lookup/?download=bundle_index/{meta_debug_id.id}/1690365600000"
    )
    assert (
        url_index
        == f"http://testserver/api/0/projects/baz/bar/artifact-lookup/?download=bundle_index/{meta_release.id}/1690365600000"
    )
