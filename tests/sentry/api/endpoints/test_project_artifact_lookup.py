import uuid
import zipfile
from datetime import datetime, timedelta, timezone
from io import BytesIO
from uuid import uuid4

import pytz
from django.urls import reverse
from freezegun import freeze_time

from sentry.models import (
    ArtifactBundle,
    DebugIdArtifactBundle,
    File,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
    ReleaseFile,
    SourceFileType,
)
from sentry.models.releasefile import read_artifact_index, update_artifact_index
from sentry.testutils import APITestCase
from sentry.utils import json


def make_file(artifact_name, content, type="artifact.bundle", headers=None):
    file = File.objects.create(name=artifact_name, type=type, headers=(headers or {}))
    file.putfile(BytesIO(content))
    return file


def make_compressed_zip_file(artifact_name, files):
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

    file = File.objects.create(name=artifact_name, type="artifact.bundle")
    file.putfile(compressed)

    return file


class ArtifactLookupTest(APITestCase):
    def assert_download_matches_file(self, url: str, file: File):
        response = self.client.get(url)
        with file.getfile() as file:
            for chunk in response:
                assert file.read(len(chunk)) == chunk

    def create_archive(self, fields, files, dist=None):
        manifest = dict(
            fields, files={filename: {"url": f"fake://{filename}"} for filename in files}
        )
        buffer = BytesIO()
        with zipfile.ZipFile(buffer, mode="w") as zf:
            zf.writestr("manifest.json", json.dumps(manifest))
            for filename, content in files.items():
                zf.writestr(filename, content)

        buffer.seek(0)
        name = f"release-artifacts-{uuid.uuid4().hex}.zip"
        file_ = File.objects.create(name=name, type="release.bundle")
        file_.putfile(buffer)
        file_.update(timestamp=datetime(2021, 6, 11, 9, 13, 1, 317902, tzinfo=timezone.utc))

        return (update_artifact_index(self.release, dist, file_), file_)

    def test_query_by_debug_ids(self):
        debug_id_a = "aaaaaaaa-0000-0000-0000-000000000000"
        debug_id_b = "bbbbbbbb-0000-0000-0000-000000000000"
        file_ab = make_compressed_zip_file(
            "bundle_ab.zip",
            {
                "path/in/zip/a": {
                    "url": "~/path/to/app.js",
                    "type": "source_map",
                    "content": b"foo_id",
                    "headers": {
                        "debug-id": debug_id_a,
                    },
                },
                "path/in/zip/b": {
                    "url": "~/path/to/app.js",
                    "type": "source_map",
                    "content": b"bar_id",
                    "headers": {
                        "debug-id": debug_id_b,
                    },
                },
            },
        )

        bundle_id_ab = uuid4()
        artifact_bundle_ab = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            bundle_id=bundle_id_ab,
            file=file_ab,
            artifact_count=2,
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle_ab,
        )
        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id=debug_id_a,
            artifact_bundle=artifact_bundle_ab,
            source_file_type=SourceFileType.SOURCE_MAP.value,
        )
        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id=debug_id_b,
            artifact_bundle=artifact_bundle_ab,
            source_file_type=SourceFileType.SOURCE_MAP.value,
        )

        debug_id_c = "cccccccc-0000-0000-0000-000000000000"
        file_c = make_compressed_zip_file(
            "bundle_c.zip",
            {
                "path/in/zip/c": {
                    "url": "~/path/to/app.js",
                    "type": "source_map",
                    "content": b"baz_id",
                    "headers": {
                        "debug-id": debug_id_c,
                    },
                },
            },
        )

        bundle_id_c = uuid4()
        artifact_bundle_c = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            bundle_id=bundle_id_c,
            file=file_c,
            artifact_count=1,
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle_c,
        )
        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id=debug_id_c,
            artifact_bundle=artifact_bundle_c,
            source_file_type=SourceFileType.SOURCE_MAP.value,
        )

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-artifact-lookup",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        # query by one debug-id
        response = self.client.get(f"{url}?debug_id={debug_id_a}").json()

        assert len(response) == 1
        assert response[0]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], file_ab)

        # query by another debug-id pointing to the same bundle
        response = self.client.get(f"{url}?debug_id={debug_id_b}").json()

        assert len(response) == 1
        assert response[0]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], file_ab)

        # query by another debug-id pointing to different bundles
        response = self.client.get(f"{url}?debug_id={debug_id_c}").json()

        assert len(response) == 1
        assert response[0]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], file_c)

    def test_query_by_url(self):
        debug_id_a = "aaaaaaaa-0000-0000-0000-000000000000"
        file_a = make_compressed_zip_file(
            "bundle_a.zip",
            {
                "path/in/zip": {
                    "url": "~/path/to/app.js",
                    "type": "source_map",
                    "content": b"foo_url",
                    "headers": {
                        "debug-id": debug_id_a,
                    },
                },
            },
        )
        file_b = make_compressed_zip_file(
            "bundle_b.zip",
            {
                "path/in/zip_a": {
                    "url": "~/path/to/app.js",
                    "type": "source_map",
                    "content": b"foo_url",
                },
                "path/in/zip_b": {
                    "url": "~/path/to/other/app.js",
                    "type": "source_map",
                    "content": b"bar_url",
                },
            },
        )

        artifact_bundle_a = ArtifactBundle.objects.create(
            organization_id=self.organization.id, bundle_id=uuid4(), file=file_a, artifact_count=1
        )
        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id=debug_id_a,
            artifact_bundle=artifact_bundle_a,
            source_file_type=SourceFileType.SOURCE_MAP.value,
        )

        artifact_bundle_b = ArtifactBundle.objects.create(
            organization_id=self.organization.id, bundle_id=uuid4(), file=file_b, artifact_count=2
        )

        dist = self.release.add_dist("whatever")

        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name=self.release.version,
            dist_name=dist.name,
            artifact_bundle=artifact_bundle_a,
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle_a,
        )
        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name=self.release.version,
            dist_name=dist.name,
            artifact_bundle=artifact_bundle_b,
        )
        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle_b,
        )

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-artifact-lookup",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        # query by url that is in both files, so we get both files
        response = self.client.get(
            f"{url}?release={self.release.version}&dist={dist.name}&url=path/to/app"
        ).json()

        assert len(response) == 2
        assert response[0]["type"] == "bundle"
        assert response[1]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], file_a)
        self.assert_download_matches_file(response[1]["url"], file_b)

        # query by both debug-id and url with overlapping bundles
        response = self.client.get(
            f"{url}?release={self.release.version}&dist={dist.name}&debug_id={debug_id_a}&url=path/to/app"
        ).json()

        assert len(response) == 1
        assert response[0]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], file_a)

    def test_query_by_url_from_releasefiles(self):
        file_headers = {"Sourcemap": "application.js.map"}
        file = make_file("application.js", b"wat", "release.file", file_headers)
        ReleaseFile.objects.create(
            organization_id=self.project.organization_id,
            release_id=self.release.id,
            file=file,
            name="http://example.com/application.js",
        )

        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-artifact-lookup",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        response = self.client.get(
            f"{url}?release={self.release.version}&url=application.js"
        ).json()

        assert len(response) == 1
        assert response[0]["type"] == "file"
        assert response[0]["abs_path"] == "http://example.com/application.js"
        assert response[0]["headers"] == file_headers
        self.assert_download_matches_file(response[0]["url"], file)

    def test_query_by_url_from_legacy_bundle(self):
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-artifact-lookup",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        assert read_artifact_index(self.release, None) is None

        archive1, archive1_file = self.create_archive(
            fields={},
            files={
                "foo": "foo1",
                "bar": "bar1",
            },
        )

        assert read_artifact_index(self.release, None) == {
            "files": {
                "fake://foo": {
                    "archive_ident": archive1.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "foo",
                    "sha1": "18a16d4530763ef43321d306c9f6c59ffed33072",
                    "size": 4,
                },
                "fake://bar": {
                    "archive_ident": archive1.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "bar",
                    "sha1": "763675d6a1d8d0a3a28deca62bb68abd8baf86f3",
                    "size": 4,
                },
            },
        }

        # Should download 1 archives as both files are within a single archive
        response = self.client.get(f"{url}?release={self.release.version}&url=foo&url=bar").json()

        assert len(response) == 1
        assert response[0]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], archive1_file)

        # Override `bar` file inside the index. It will now have different `sha1`` and different `archive_ident` as it comes from other archive.
        archive2, archive2_file = self.create_archive(
            fields={},
            files={
                "bar": "BAR1",
            },
        )

        assert read_artifact_index(self.release, None) == {
            "files": {
                "fake://foo": {
                    "archive_ident": archive1.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "foo",
                    "sha1": "18a16d4530763ef43321d306c9f6c59ffed33072",
                    "size": 4,
                },
                "fake://bar": {
                    "archive_ident": archive2.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "bar",
                    "sha1": "7f9353c7b307875542883ba558a1692706fcad33",
                    "size": 4,
                },
            },
        }

        response = self.client.get(f"{url}?release={self.release.version}&url=foo").json()

        assert len(response) == 2
        assert response[0]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], archive1_file)
        assert response[1]["type"] == "bundle"
        self.assert_download_matches_file(response[1]["url"], archive2_file)

        response = self.client.get(f"{url}?release={self.release.version}&url=bar").json()

        assert len(response) == 2
        assert response[0]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], archive1_file)
        assert response[1]["type"] == "bundle"
        self.assert_download_matches_file(response[1]["url"], archive2_file)

    def test_query_by_url_and_dist_from_legacy_bundle(self):
        self.login_as(user=self.user)

        url = reverse(
            "sentry-api-0-project-artifact-lookup",
            kwargs={
                "organization_slug": self.project.organization.slug,
                "project_slug": self.project.slug,
            },
        )

        dist = self.release.add_dist("foo")

        archive1, archive1_file = self.create_archive(
            fields={},
            files={
                "foo": "foo2",
                "bar": "bar2",
            },
            dist=dist,
        )

        # No index for dist-less requests.
        assert read_artifact_index(self.release, None) is None

        assert read_artifact_index(self.release, dist) == {
            "files": {
                "fake://foo": {
                    "archive_ident": archive1.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "foo",
                    "sha1": "aaadd94977b8fbf3f6fb09fc3bbbc9edbdfa8427",
                    "size": 4,
                },
                "fake://bar": {
                    "archive_ident": archive1.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "bar",
                    "sha1": "033c4846b506a4a48e32cdf54515c91d3499adb3",
                    "size": 4,
                },
            },
        }

        # Should download 1 archives as both files are within a single archive
        response = self.client.get(
            f"{url}?release={self.release.version}&url=foo&url=bar&dist=foo"
        ).json()

        assert len(response) == 1
        assert response[0]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], archive1_file)

        # Override `bar` file inside the index. It will now have different `sha1`` and different `archive_ident` as it comes from other archive.
        archive2, archive2_file = self.create_archive(
            fields={},
            files={
                "bar": "BAR2",
            },
            dist=dist,
        )

        assert read_artifact_index(self.release, dist) == {
            "files": {
                "fake://foo": {
                    "archive_ident": archive1.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "foo",
                    "sha1": "aaadd94977b8fbf3f6fb09fc3bbbc9edbdfa8427",
                    "size": 4,
                },
                "fake://bar": {
                    "archive_ident": archive2.ident,
                    "date_created": "2021-06-11T09:13:01.317902Z",
                    "filename": "bar",
                    "sha1": "528c5563f06a1e98954d17d365a219b68dd93baf",
                    "size": 4,
                },
            },
        }

        response = self.client.get(
            f"{url}?release={self.release.version}&dist={dist.name}&url=foo"
        ).json()

        assert len(response) == 2
        assert response[0]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], archive1_file)
        assert response[1]["type"] == "bundle"
        self.assert_download_matches_file(response[1]["url"], archive2_file)

        # Should download 2 archives as they have different `archive_ident`
        response = self.client.get(
            f"{url}?release={self.release.version}&dist={dist.name}&url=bar"
        ).json()

        assert len(response) == 2
        assert response[0]["type"] == "bundle"
        self.assert_download_matches_file(response[0]["url"], archive1_file)
        assert response[1]["type"] == "bundle"
        self.assert_download_matches_file(response[1]["url"], archive2_file)

    @freeze_time("2023-05-23 10:00:00")
    def test_renewal_with_debug_id(self):
        with self.options({"sourcemaps.artifact-bundles.enable-renewal": 1.0}):
            for days_before, expected_date_added, debug_id in (
                (
                    2,
                    datetime.now(tz=pytz.UTC) - timedelta(days=2),
                    "2432d9ad-fe87-4f77-938d-50cc9b2b2e2a",
                ),
                (35, datetime.now(tz=pytz.UTC), "ef88bc3e-d334-4809-9723-5c5dbc8bd4e9"),
            ):
                file = make_compressed_zip_file(
                    "bundle_c.zip",
                    {
                        "path/in/zip/c": {
                            "url": "~/path/to/app.js",
                            "type": "source_map",
                            "content": b"baz_renew",
                            "headers": {
                                "debug-id": debug_id,
                            },
                        },
                    },
                )
                bundle_id = uuid4()
                date_added = datetime.now(tz=pytz.UTC) - timedelta(days=days_before)

                artifact_bundle = ArtifactBundle.objects.create(
                    organization_id=self.organization.id,
                    bundle_id=bundle_id,
                    file=file,
                    artifact_count=1,
                    date_added=date_added,
                )
                ProjectArtifactBundle.objects.create(
                    organization_id=self.organization.id,
                    project_id=self.project.id,
                    artifact_bundle=artifact_bundle,
                    date_added=date_added,
                )
                DebugIdArtifactBundle.objects.create(
                    organization_id=self.organization.id,
                    debug_id=debug_id,
                    artifact_bundle=artifact_bundle,
                    source_file_type=SourceFileType.SOURCE_MAP.value,
                    date_added=date_added,
                )

                self.login_as(user=self.user)

                url = reverse(
                    "sentry-api-0-project-artifact-lookup",
                    kwargs={
                        "organization_slug": self.project.organization.slug,
                        "project_slug": self.project.slug,
                    },
                )

                with self.tasks():
                    self.client.get(f"{url}?debug_id={debug_id}")

                assert (
                    ArtifactBundle.objects.get(id=artifact_bundle.id).date_added
                    == expected_date_added
                )
                assert (
                    ProjectArtifactBundle.objects.get(
                        artifact_bundle_id=artifact_bundle.id
                    ).date_added
                    == expected_date_added
                )
                assert (
                    DebugIdArtifactBundle.objects.get(
                        artifact_bundle_id=artifact_bundle.id
                    ).date_added
                    == expected_date_added
                )

    @freeze_time("2023-05-23 10:00:00")
    def test_renewal_with_url(self):
        with self.options({"sourcemaps.artifact-bundles.enable-renewal": 1.0}):
            file = make_compressed_zip_file(
                "bundle_c.zip",
                {
                    "path/in/zip/c": {
                        "url": "~/path/to/app.js",
                        "type": "source_map",
                        "content": b"baz_renew",
                    },
                },
            )

            for days_before, expected_date_added, release in (
                (
                    2,
                    datetime.now(tz=pytz.UTC) - timedelta(days=2),
                    self.create_release(version="1.0"),
                ),
                (35, datetime.now(tz=pytz.UTC), self.create_release(version="2.0")),
            ):
                dist = release.add_dist("android")
                bundle_id = uuid4()
                date_added = datetime.now(tz=pytz.UTC) - timedelta(days=days_before)

                artifact_bundle = ArtifactBundle.objects.create(
                    organization_id=self.organization.id,
                    bundle_id=bundle_id,
                    file=file,
                    artifact_count=1,
                    date_added=date_added,
                )
                ProjectArtifactBundle.objects.create(
                    organization_id=self.organization.id,
                    project_id=self.project.id,
                    artifact_bundle=artifact_bundle,
                    date_added=date_added,
                )
                ReleaseArtifactBundle.objects.create(
                    organization_id=self.organization.id,
                    release_name=release.version,
                    dist_name=dist.name,
                    artifact_bundle=artifact_bundle,
                    date_added=date_added,
                )

                self.login_as(user=self.user)

                url = reverse(
                    "sentry-api-0-project-artifact-lookup",
                    kwargs={
                        "organization_slug": self.project.organization.slug,
                        "project_slug": self.project.slug,
                    },
                )

                with self.tasks():
                    self.client.get(
                        f"{url}?release={release.version}&dist={dist.name}&url=path/to/app"
                    )

                assert (
                    ArtifactBundle.objects.get(id=artifact_bundle.id).date_added
                    == expected_date_added
                )
                assert (
                    ProjectArtifactBundle.objects.get(
                        artifact_bundle_id=artifact_bundle.id
                    ).date_added
                    == expected_date_added
                )
                assert (
                    ReleaseArtifactBundle.objects.get(
                        artifact_bundle_id=artifact_bundle.id
                    ).date_added
                    == expected_date_added
                )
