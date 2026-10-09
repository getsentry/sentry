from __future__ import annotations

import zipfile
from io import BytesIO
from typing import Any
from unittest import mock

import orjson
from django.core.files.base import ContentFile
from django.db import connections, router
from django.test.utils import CaptureQueriesContext
from rest_framework import status

from sentry.api.endpoints.source_map_debug import (
    MIN_JS_SDK_VERSION_FOR_DEBUG_IDS,
    get_release_bundle_urls,
)
from sentry.models.artifactbundle import (
    ArtifactBundle,
    ArtifactBundleIndex,
    DebugIdArtifactBundle,
    ProjectArtifactBundle,
    ReleaseArtifactBundle,
    SourceFileType,
)
from sentry.models.distribution import Distribution
from sentry.models.file import File
from sentry.models.release import Release
from sentry.models.releasefile import ARTIFACT_INDEX_FILENAME, ARTIFACT_INDEX_TYPE, ReleaseFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


def create_exception_with_frame(frame: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "Error",
        "raw_stacktrace": {"frames": [frame]},
    }


def create_exception_with_frames(
    raw_frames: list[dict[str, Any]] | None = None,
    frames: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    ex: dict[str, Any] = {"type": "Error"}

    if raw_frames is not None:
        ex["raw_stacktrace"] = {"frames": raw_frames}

    if frames is not None:
        ex["stacktrace"] = {"frames": frames}

    return ex


def create_event(
    exceptions: list[dict[str, Any]] | None = None,
    debug_meta_images: list[dict[str, Any]] | None = None,
    sdk: dict[str, Any] | None = None,
    release: str | None = None,
    dist: str | None = None,
    scraping_attempts: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    exceptions = [] if exceptions is None else exceptions
    event = {
        "event_id": "a" * 32,
        "release": release,
        "dist": dist,
        "exception": {"values": exceptions},
        "debug_meta": None if debug_meta_images is None else {"images": debug_meta_images},
        "sdk": sdk,
        "scraping_attempts": scraping_attempts,
    }

    if scraping_attempts is not None:
        event["scraping_attempts"] = scraping_attempts

    return event


class SourceMapDebugEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-event-source-map-debug"

    def setUp(self) -> None:
        self.login_as(self.user)
        return super().setUp()

    def test_missing_event(self) -> None:
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            "invalid_id",
            frame_idx=0,
            exception_idx=0,
            status_code=status.HTTP_404_NOT_FOUND,
        )
        assert resp.data["detail"] == "Event not found"

    def test_empty_exceptions_array(self) -> None:
        event = self.store_event(data=create_event([]), project_id=self.project.id)
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )
        assert resp.data["exceptions"] == []

    def test_has_debug_ids_true(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[create_exception_with_frame({"abs_path": "/some/path/to/file.js"})],
                debug_meta_images=[
                    {
                        "type": "sourcemap",
                        "code_file": "/some/path/to/file.js",
                        "debug_id": "8d65dbd3-bb6c-5632-9049-7751111284ed",
                    }
                ],
            ),
            project_id=self.project.id,
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )
        assert resp.data["has_debug_ids"]

    def test_has_debug_ids_false(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[create_exception_with_frame({"abs_path": "/some/path/to/file.js"})],
                debug_meta_images=None,
            ),
            project_id=self.project.id,
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )
        assert not resp.data["has_debug_ids"]

    def test_sdk_version(self) -> None:
        event = self.store_event(
            data=create_event(sdk={"name": "sentry.javascript.react", "version": "7.66.0"}),
            project_id=self.project.id,
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )
        assert resp.data["sdk_version"] == "7.66.0"

    def test_no_sdk_version(self) -> None:
        event = self.store_event(data=create_event(), project_id=self.project.id)
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )
        assert resp.data["sdk_version"] is None

    def test_sdk_debug_id_support_full(self) -> None:
        event = self.store_event(
            data=create_event(sdk={"name": "sentry.javascript.react", "version": "7.66.0"}),
            project_id=self.project.id,
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )
        assert resp.data["sdk_debug_id_support"] == "full"

    def test_sdk_debug_id_support_needs_upgrade(self) -> None:
        event = self.store_event(
            data=create_event(sdk={"name": "sentry.javascript.react", "version": "7.47.0"}),
            project_id=self.project.id,
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )
        assert resp.data["sdk_debug_id_support"] == "needs-upgrade", (
            MIN_JS_SDK_VERSION_FOR_DEBUG_IDS
        )

    def test_sdk_debug_id_support_unsupported(self) -> None:
        event = self.store_event(
            data=create_event(sdk={"name": "sentry.javascript.cordova", "version": "7.47.0"}),
            project_id=self.project.id,
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )
        assert resp.data["sdk_debug_id_support"] == "not-supported"

    def test_sdk_debug_id_support_community_sdk(self) -> None:
        event = self.store_event(
            data=create_event(
                sdk={"name": "sentry.javascript.some-custom-identifier", "version": "7.47.0"}
            ),
            project_id=self.project.id,
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )
        assert resp.data["sdk_debug_id_support"] == "unofficial-sdk"

    def test_release_has_some_artifact_positive(self) -> None:
        event = self.store_event(
            data=create_event(release="some-release"),
            project_id=self.project.id,
        )

        release = Release.objects.get(organization=self.organization, version=event.release)

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=File.objects.create(name="bundle.js", type="release.file"),
            name="~/bundle.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert resp.data["release_has_some_artifact"]

    def test_release_has_some_artifact_negative(self) -> None:
        event = self.store_event(
            data=create_event(release="some-release"),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert not resp.data["release_has_some_artifact"]

    def test_project_has_some_artifact_bundle_positive(self) -> None:
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=File.objects.create(name="artifact-bundle.zip", type="dummy.file"),
            artifact_count=1,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )

        event = self.store_event(
            data=create_event(),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert resp.data["project_has_some_artifact_bundle"]

    def test_project_has_some_artifact_bundle_negative(self) -> None:
        event = self.store_event(
            data=create_event(),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert not resp.data["project_has_some_artifact_bundle"]

    def test_project_has_some_artifact_bundle_with_a_debug_id_positive(self) -> None:
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=File.objects.create(name="artifact-bundle.zip", type="dummy.file"),
            artifact_count=1,
        )

        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id="00000000-00000000-00000000-00000000",
            artifact_bundle=artifact_bundle,
            source_file_type=SourceFileType.SOURCE_MAP.value,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )

        event = self.store_event(
            data=create_event(),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert resp.data["has_uploaded_some_artifact_with_a_debug_id"]

    def test_project_has_some_artifact_bundle_with_a_debug_id_negative(self) -> None:
        event = self.store_event(
            data=create_event(),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert not resp.data["has_uploaded_some_artifact_with_a_debug_id"]

    def create_project_artifact_bundle(self, project_id: int, with_debug_id: bool) -> None:
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=File.objects.create(name="artifact-bundle.zip", type="dummy.file"),
            artifact_count=1,
        )

        if with_debug_id:
            DebugIdArtifactBundle.objects.create(
                organization_id=self.organization.id,
                debug_id="00000000-00000000-00000000-00000000",
                artifact_bundle=artifact_bundle,
                source_file_type=SourceFileType.SOURCE_MAP.value,
            )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project_id,
            artifact_bundle=artifact_bundle,
        )

    @override_options({"sourcemaps.source-map-debug.debug-id-check-max-bundles": 2})
    def test_project_has_some_artifact_bundle_with_a_debug_id_in_newest_bundles(self) -> None:
        self.create_project_artifact_bundle(self.project.id, with_debug_id=True)
        self.create_project_artifact_bundle(self.project.id, with_debug_id=False)

        event = self.store_event(
            data=create_event(),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert resp.data["has_uploaded_some_artifact_with_a_debug_id"]

    def test_project_has_some_artifact_bundle_with_a_debug_id_only_in_older_bundles(self) -> None:
        self.create_project_artifact_bundle(self.project.id, with_debug_id=True)
        self.create_project_artifact_bundle(self.project.id, with_debug_id=False)
        self.create_project_artifact_bundle(self.project.id, with_debug_id=False)

        event = self.store_event(
            data=create_event(),
            project_id=self.project.id,
        )

        with override_options({"sourcemaps.source-map-debug.debug-id-check-max-bundles": 2}):
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                event.event_id,
            )
        assert not resp.data["has_uploaded_some_artifact_with_a_debug_id"]

        with override_options({"sourcemaps.source-map-debug.debug-id-check-max-bundles": 3}):
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                event.event_id,
            )
        assert resp.data["has_uploaded_some_artifact_with_a_debug_id"]

    @override_options({"sourcemaps.source-map-debug.debug-id-check-max-bundles": 2})
    def test_project_has_some_artifact_bundle_with_a_debug_id_in_other_project(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.create_project_artifact_bundle(other_project.id, with_debug_id=True)
        self.create_project_artifact_bundle(self.project.id, with_debug_id=False)

        event = self.store_event(
            data=create_event(),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert not resp.data["has_uploaded_some_artifact_with_a_debug_id"]

    @override_options({"sourcemaps.source-map-debug.debug-id-check-max-bundles": 2})
    def test_project_has_some_artifact_bundle_with_a_debug_id_reads_project_bundles(self) -> None:
        self.create_project_artifact_bundle(self.project.id, with_debug_id=False)

        event = self.store_event(
            data=create_event(),
            project_id=self.project.id,
        )

        with CaptureQueriesContext(
            connections[router.db_for_read(DebugIdArtifactBundle)]
        ) as queries:
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                event.event_id,
            )

        assert not resp.data["has_uploaded_some_artifact_with_a_debug_id"]
        # The organization's debug-ID rows aren't read, only those of the project's bundles.
        debug_id_queries = [
            query["sql"]
            for query in queries.captured_queries
            if 'FROM "sentry_debugidartifactbundle"' in query["sql"]
        ]
        assert len(debug_id_queries) == 1
        assert '"sentry_debugidartifactbundle"."organization_id"' not in debug_id_queries[0]
        assert '"sentry_debugidartifactbundle"."artifact_bundle_id" IN' in debug_id_queries[0]

    def test_multiple_exceptions(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "/some/path/to/file.js"}),
                    create_exception_with_frame({"abs_path": "/some/path/to/some/other/file.js"}),
                ],
            ),
            project_id=self.project.id,
        )
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )
        assert len(resp.data["exceptions"]) == 2

    def test_frame_debug_id_no_debug_id(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[create_exception_with_frame({"abs_path": "/some/path/to/file.js"})],
                debug_meta_images=[
                    {
                        "type": "sourcemap",
                        "code_file": "/some/path/to/file/that/doesnt/match.js",
                        "debug_id": "8d65dbd3-bb6c-5632-9049-7751111284ed",
                    }
                ],
            ),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        debug_id_process_result = resp.data["exceptions"][0]["frames"][0]["debug_id_process"]

        assert debug_id_process_result["debug_id"] is None
        assert not debug_id_process_result["uploaded_source_file_with_correct_debug_id"]
        assert not debug_id_process_result["uploaded_source_map_with_correct_debug_id"]

    def test_frame_debug_id_no_uploaded_source_no_uploaded_source_map(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[create_exception_with_frame({"abs_path": "/some/path/to/file.js"})],
                debug_meta_images=[
                    {
                        "type": "sourcemap",
                        "code_file": "/some/path/to/file.js",
                        "debug_id": "a5764857-ae35-34dc-8f25-a9c9e73aa898",
                    }
                ],
            ),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        debug_id_process_result = resp.data["exceptions"][0]["frames"][0]["debug_id_process"]

        assert debug_id_process_result["debug_id"] == "a5764857-ae35-34dc-8f25-a9c9e73aa898"
        assert not debug_id_process_result["uploaded_source_file_with_correct_debug_id"]
        assert not debug_id_process_result["uploaded_source_map_with_correct_debug_id"]

    def test_frame_debug_id_uploaded_source_no_uploaded_source_map(self) -> None:
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=File.objects.create(name="artifact-bundle.zip", type="test.file"),
            artifact_count=1,
        )

        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id="a5764857-ae35-34dc-8f25-a9c9e73aa898",
            artifact_bundle=artifact_bundle,
            source_file_type=SourceFileType.MINIFIED_SOURCE.value,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )

        event = self.store_event(
            data=create_event(
                exceptions=[create_exception_with_frame({"abs_path": "/some/path/to/file.js"})],
                debug_meta_images=[
                    {
                        "type": "sourcemap",
                        "code_file": "/some/path/to/file.js",
                        "debug_id": "a5764857-ae35-34dc-8f25-a9c9e73aa898",
                    }
                ],
            ),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        debug_id_process_result = resp.data["exceptions"][0]["frames"][0]["debug_id_process"]

        assert debug_id_process_result["debug_id"] == "a5764857-ae35-34dc-8f25-a9c9e73aa898"
        assert debug_id_process_result["uploaded_source_file_with_correct_debug_id"]
        assert not debug_id_process_result["uploaded_source_map_with_correct_debug_id"]

    def test_frame_debug_id_no_uploaded_source_uploaded_source_map(self) -> None:
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=File.objects.create(name="artifact-bundle.zip", type="test.file"),
            artifact_count=1,
        )

        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id="a5764857-ae35-34dc-8f25-a9c9e73aa898",
            artifact_bundle=artifact_bundle,
            source_file_type=SourceFileType.SOURCE_MAP.value,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )

        event = self.store_event(
            data=create_event(
                exceptions=[create_exception_with_frame({"abs_path": "/some/path/to/file.js"})],
                debug_meta_images=[
                    {
                        "type": "sourcemap",
                        "code_file": "/some/path/to/file.js",
                        "debug_id": "a5764857-ae35-34dc-8f25-a9c9e73aa898",
                    }
                ],
            ),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        debug_id_process_result = resp.data["exceptions"][0]["frames"][0]["debug_id_process"]

        assert debug_id_process_result["debug_id"] == "a5764857-ae35-34dc-8f25-a9c9e73aa898"
        assert not debug_id_process_result["uploaded_source_file_with_correct_debug_id"]
        assert debug_id_process_result["uploaded_source_map_with_correct_debug_id"]

    def test_frame_debug_id_uploaded_source_uploaded_source_map(self) -> None:
        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=File.objects.create(name="artifact-bundle.zip", type="test.file"),
            artifact_count=1,
        )

        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id="a5764857-ae35-34dc-8f25-a9c9e73aa898",
            artifact_bundle=artifact_bundle,
            source_file_type=SourceFileType.SOURCE.value,
        )

        DebugIdArtifactBundle.objects.create(
            organization_id=self.organization.id,
            debug_id="a5764857-ae35-34dc-8f25-a9c9e73aa898",
            artifact_bundle=artifact_bundle,
            source_file_type=SourceFileType.SOURCE_MAP.value,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )

        event = self.store_event(
            data=create_event(
                exceptions=[create_exception_with_frame({"abs_path": "/some/path/to/file.js"})],
                debug_meta_images=[
                    {
                        "type": "sourcemap",
                        "code_file": "/some/path/to/file.js",
                        "debug_id": "a5764857-ae35-34dc-8f25-a9c9e73aa898",
                    }
                ],
            ),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        debug_id_process_result = resp.data["exceptions"][0]["frames"][0]["debug_id_process"]

        assert debug_id_process_result["debug_id"] == "a5764857-ae35-34dc-8f25-a9c9e73aa898"
        assert debug_id_process_result["uploaded_source_file_with_correct_debug_id"]
        assert debug_id_process_result["uploaded_source_map_with_correct_debug_id"]

    def test_frame_release_process_release_file_matching_source_file_names(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["matching_source_file_names"] == [
            "http://example.com/bundle.js",
            "~/bundle.js",
        ]

    def test_frame_release_process_release_file_source_map_reference(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )

        release = Release.objects.get(organization=self.organization, version=event.release)

        file = File.objects.create(name="bundle.js", type="release.file")
        fileobj = ContentFile(b'console.log("hello world");\n//# sourceMappingURL=bundle.js.map\n')
        file.putfile(fileobj)

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=file,
            name="~/bundle.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["matching_source_map_name"] == "~/bundle.js.map"
        assert release_process_result["source_map_reference"] == "bundle.js.map"

    def test_frame_release_process_release_file_data_protocol_source_map_reference(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )

        release = Release.objects.get(organization=self.organization, version=event.release)

        file = File.objects.create(
            name="bundle.js",
            type="release.file",
            headers={
                "Sourcemap": "data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcy"
            },
        )

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=file,
            name="~/bundle.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_map_lookup_result"] == "found"
        assert release_process_result["source_map_reference"] == "Inline Sourcemap"
        assert release_process_result["matching_source_map_name"] is None

    def test_frame_release_process_release_file_source_file_not_found(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "unsuccessful"
        assert release_process_result["source_map_lookup_result"] == "unsuccessful"
        assert release_process_result["source_map_reference"] is None
        assert release_process_result["matching_source_map_name"] is None

    def test_frame_release_process_release_file_source_file_wrong_dist(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.js"})
                ],
                release="some-release",
                dist="some-dist",
            ),
            project_id=self.project.id,
        )

        release = Release.objects.get(organization=self.organization, version=event.release)

        file = File.objects.create(
            name="bundle.js", type="release.file", headers={"Sourcemap": "bundle.js.map"}
        )

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=file,
            name="~/bundle.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "wrong-dist"
        assert release_process_result["source_map_lookup_result"] == "unsuccessful"
        assert release_process_result["source_map_reference"] is None
        assert release_process_result["matching_source_map_name"] is None

    def test_frame_release_process_release_file_source_file_successful(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )

        release = Release.objects.get(organization=self.organization, version=event.release)

        file = File.objects.create(
            name="bundle.js", type="release.file", headers={"Sourcemap": "bundle.js.map"}
        )

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=file,
            name="~/bundle.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "unsuccessful"
        assert release_process_result["source_map_reference"] == "bundle.js.map"
        assert release_process_result["matching_source_map_name"] == "~/bundle.js.map"

    def test_frame_release_process_release_file_source_map_wrong_dist(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.js"})
                ],
                release="some-release",
                dist="some-dist",
            ),
            project_id=self.project.id,
        )

        release = Release.objects.get(organization=self.organization, version=event.release)

        source_file = File.objects.create(
            name="bundle.js", type="release.file", headers={"Sourcemap": "bundle.js.map"}
        )

        source_map_file = File.objects.create(
            name="bundle.js.map",
            type="release.file",
        )

        dist = Distribution.objects.get(name="some-dist", release=release)

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=source_file,
            name="~/bundle.js",
            ident=ReleaseFile.get_ident("~/bundle.js", dist.name),
            dist_id=dist.id,
        )

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=source_map_file,
            name="~/bundle.js.map",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "wrong-dist"
        assert release_process_result["source_map_reference"] == "bundle.js.map"
        assert release_process_result["matching_source_map_name"] == "~/bundle.js.map"

    def test_frame_release_process_release_file_source_map_successful(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/static/bundle.js"})
                ],
                release="some-release",
                dist="some-dist",
            ),
            project_id=self.project.id,
        )

        release = Release.objects.get(organization=self.organization, version=event.release)

        source_file = File.objects.create(
            name="static/bundle.js",
            type="release.file",
            headers={"Sourcemap": "../bundle.js.map"},
        )

        source_map_file = File.objects.create(
            name="bundle.js.map",
            type="release.file",
        )

        dist = Distribution.objects.get(name="some-dist", release=release)

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=source_file,
            name="~/static/bundle.js",
            ident=ReleaseFile.get_ident("~/static/bundle.js", dist.name),
            dist_id=dist.id,
        )

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=source_map_file,
            name="~/bundle.js.map",
            ident=ReleaseFile.get_ident("~/bundle.js.map", dist.name),
            dist_id=dist.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "found"
        assert release_process_result["source_map_reference"] == "../bundle.js.map"
        assert release_process_result["matching_source_map_name"] == "~/bundle.js.map"

    def test_frame_release_process_artifact_bundle_data_protocol_source_map_reference(self) -> None:
        compressed = BytesIO(b"SYSB")
        with zipfile.ZipFile(compressed, "a") as zip_file:
            zip_file.writestr("files/_/_/bundle.min.js", b'console.log("hello world");')
            zip_file.writestr(
                "manifest.json",
                orjson.dumps(
                    {
                        "files": {
                            "files/_/_/bundle.min.js": {
                                "url": "~/bundle.min.js",
                                "type": "minified_source",
                                "headers": {
                                    "content-type": "application/json",
                                    "Sourcemap": "data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcy",
                                },
                            },
                        },
                    }
                ).decode(),
            )
        compressed.seek(0)

        file_obj = File.objects.create(name="artifact_bundle.zip", type="artifact.bundle")
        file_obj.putfile(compressed)

        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )

        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=file_obj,
            artifact_count=1,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )

        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="some-release",
            artifact_bundle=artifact_bundle,
        )

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=artifact_bundle,
            url="~/bundle.min.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "found"
        assert release_process_result["source_map_reference"] == "Inline Sourcemap"
        assert release_process_result["matching_source_map_name"] is None

    def test_frame_release_process_artifact_bundle_source_file_wrong_dist(self) -> None:
        compressed = BytesIO(b"SYSB")
        with zipfile.ZipFile(compressed, "a") as zip_file:
            zip_file.writestr(
                "files/_/_/bundle.min.js",
                b'console.log("hello world");\n//# sourceMappingURL=bundle.min.js.map\n',
            )
            zip_file.writestr(
                "manifest.json",
                orjson.dumps(
                    {
                        "files": {
                            "files/_/_/bundle.min.js": {
                                "url": "~/bundle.min.js",
                                "type": "minified_source",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                        },
                    }
                ).decode(),
            )
        compressed.seek(0)

        file_obj = File.objects.create(name="artifact_bundle.zip", type="artifact.bundle")
        file_obj.putfile(compressed)

        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
                dist="some-dist",
            ),
            project_id=self.project.id,
        )

        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=file_obj,
            artifact_count=1,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )

        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="some-release",
            artifact_bundle=artifact_bundle,
        )

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=artifact_bundle,
            url="~/bundle.min.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "wrong-dist"

    def test_frame_release_process_artifact_bundle_source_file_successful(self) -> None:
        compressed = BytesIO(b"SYSB")
        with zipfile.ZipFile(compressed, "a") as zip_file:
            zip_file.writestr(
                "files/_/_/bundle.min.js",
                b'console.log("hello world");\n//# sourceMappingURL=bundle.min.js.map\n',
            )
            zip_file.writestr(
                "manifest.json",
                orjson.dumps(
                    {
                        "files": {
                            "files/_/_/bundle.min.js": {
                                "url": "~/bundle.min.js",
                                "type": "minified_source",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                        },
                    }
                ).decode(),
            )
        compressed.seek(0)

        file_obj = File.objects.create(name="artifact_bundle.zip", type="artifact.bundle")
        file_obj.putfile(compressed)

        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )

        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=file_obj,
            artifact_count=1,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )

        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="some-release",
            artifact_bundle=artifact_bundle,
        )

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=artifact_bundle,
            url="~/bundle.min.js",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "found"

    def test_frame_release_process_artifact_bundle_source_map_not_found(self) -> None:
        compressed = BytesIO(b"SYSB")
        with zipfile.ZipFile(compressed, "a") as zip_file:
            zip_file.writestr(
                "files/_/_/bundle.min.js",
                b'console.log("hello world");\n//# sourceMappingURL=bundle.min.js.map\n',
            )
            zip_file.writestr("files/_/_/bundle.min.js.map", b"")
            zip_file.writestr(
                "manifest.json",
                orjson.dumps(
                    {
                        "files": {
                            "files/_/_/bundle.min.js": {
                                "url": "~/bundle.min.js",
                                "type": "minified_source",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                            "files/_/_/wrong-bundle.min.js.map": {
                                "url": "~/wrong-bundle.min.js.map",
                                "type": "source_map",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                        },
                    }
                ).decode(),
            )
        compressed.seek(0)

        file_obj = File.objects.create(name="artifact_bundle.zip", type="artifact.bundle")
        file_obj.putfile(compressed)

        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )

        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=file_obj,
            artifact_count=1,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )

        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="some-release",
            artifact_bundle=artifact_bundle,
        )

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=artifact_bundle,
            url="~/bundle.min.js",
        )

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=artifact_bundle,
            url="~/wrong-bundle.min.js.map",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "unsuccessful"
        assert release_process_result["source_map_reference"] == "bundle.min.js.map"
        assert release_process_result["matching_source_map_name"] == "~/bundle.min.js.map"

    def test_frame_release_process_artifact_bundle_source_map_wrong_dist(self) -> None:
        compressed = BytesIO(b"SYSB")
        with zipfile.ZipFile(compressed, "a") as zip_file:
            zip_file.writestr(
                "files/_/_/bundle.min.js",
                b'console.log("hello world");\n//# sourceMappingURL=bundle.min.js.map\n',
            )
            zip_file.writestr("files/_/_/bundle.min.js.map", b"")
            zip_file.writestr(
                "manifest.json",
                orjson.dumps(
                    {
                        "files": {
                            "files/_/_/bundle.min.js": {
                                "url": "~/bundle.min.js",
                                "type": "minified_source",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                            "files/_/_/bundle.min.js.map": {
                                "url": "~/bundle.min.js.map",
                                "type": "source_map",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                        },
                    }
                ).decode(),
            )
        compressed.seek(0)

        file_obj = File.objects.create(name="artifact_bundle.zip", type="artifact.bundle")
        file_obj.putfile(compressed)

        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
                dist="some-dist",
            ),
            project_id=self.project.id,
        )

        source_file_artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=file_obj,
            artifact_count=1,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=source_file_artifact_bundle,
        )

        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="some-release",
            dist_name="some-dist",
            artifact_bundle=source_file_artifact_bundle,
        )

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=source_file_artifact_bundle,
            url="~/bundle.min.js",
        )

        source_map_artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=file_obj,
            artifact_count=1,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=source_map_artifact_bundle,
        )

        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="some-release",
            dist_name="some-other-dist",
            artifact_bundle=source_map_artifact_bundle,
        )

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=source_map_artifact_bundle,
            url="~/bundle.min.js",
        )

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=source_map_artifact_bundle,
            url="~/bundle.min.js.map",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "wrong-dist"
        assert release_process_result["source_map_reference"] == "bundle.min.js.map"
        assert release_process_result["matching_source_map_name"] == "~/bundle.min.js.map"

    def test_frame_release_process_artifact_bundle_source_map_successful(self) -> None:
        compressed = BytesIO(b"SYSB")
        with zipfile.ZipFile(compressed, "a") as zip_file:
            zip_file.writestr(
                "files/_/_/bundle.min.js",
                b'console.log("hello world");\n//# sourceMappingURL=bundle.min.js.map\n',
            )
            zip_file.writestr("files/_/_/bundle.min.js.map", b"")
            zip_file.writestr(
                "manifest.json",
                orjson.dumps(
                    {
                        "files": {
                            "files/_/_/bundle.min.js": {
                                "url": "~/bundle.min.js",
                                "type": "minified_source",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                            "files/_/_/bundle.min.js.map": {
                                "url": "~/bundle.min.js.map",
                                "type": "source_map",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                        },
                    }
                ).decode(),
            )
        compressed.seek(0)

        file_obj = File.objects.create(name="artifact_bundle.zip", type="artifact.bundle")
        file_obj.putfile(compressed)

        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )

        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=file_obj,
            artifact_count=1,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=self.project.id,
            artifact_bundle=artifact_bundle,
        )

        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="some-release",
            artifact_bundle=artifact_bundle,
        )

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=artifact_bundle,
            url="~/bundle.min.js",
        )

        ArtifactBundleIndex.objects.create(
            organization_id=self.organization.id,
            artifact_bundle=artifact_bundle,
            url="~/bundle.min.js.map",
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "found"
        assert release_process_result["source_map_reference"] == "bundle.min.js.map"
        assert release_process_result["matching_source_map_name"] == "~/bundle.min.js.map"

    def create_release_artifact_bundle(
        self,
        indexed_urls: list[str],
        dist_name: str = "",
        artifact_count: int = 2,
        project_id: int | None = None,
    ) -> None:
        """
        Creates a bundle of `~/bundle.min.js` and its source map in `some-release`, indexed under
        `indexed_urls` and linked to `project_id`, by default the test's project.
        """
        compressed = BytesIO(b"SYSB")
        with zipfile.ZipFile(compressed, "a") as zip_file:
            zip_file.writestr(
                "files/_/_/bundle.min.js",
                b'console.log("hello world");\n//# sourceMappingURL=bundle.min.js.map\n',
            )
            zip_file.writestr("files/_/_/bundle.min.js.map", b"")
            zip_file.writestr(
                "manifest.json",
                orjson.dumps(
                    {
                        "files": {
                            "files/_/_/bundle.min.js": {
                                "url": "~/bundle.min.js",
                                "type": "minified_source",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                            "files/_/_/bundle.min.js.map": {
                                "url": "~/bundle.min.js.map",
                                "type": "source_map",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                        },
                    }
                ).decode(),
            )
        compressed.seek(0)

        file_obj = File.objects.create(name="artifact_bundle.zip", type="artifact.bundle")
        file_obj.putfile(compressed)

        artifact_bundle = ArtifactBundle.objects.create(
            organization_id=self.organization.id,
            file=file_obj,
            artifact_count=artifact_count,
        )

        ProjectArtifactBundle.objects.create(
            organization_id=self.organization.id,
            project_id=project_id or self.project.id,
            artifact_bundle=artifact_bundle,
        )

        ReleaseArtifactBundle.objects.create(
            organization_id=self.organization.id,
            release_name="some-release",
            dist_name=dist_name,
            artifact_bundle=artifact_bundle,
        )

        for url in indexed_urls:
            ArtifactBundleIndex.objects.create(
                organization_id=self.organization.id,
                artifact_bundle=artifact_bundle,
                url=url,
            )

    def get_release_process_result(self, event_id: str) -> dict[str, Any]:
        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event_id,
        )
        return resp.data["exceptions"][0]["frames"][0]["release_process"]

    @override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 10})
    def test_frame_release_process_artifact_bundle_url_match_by_bundle_successful(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )
        self.create_release_artifact_bundle(["~/bundle.min.js", "~/bundle.min.js.map"])

        release_process_result = self.get_release_process_result(event.event_id)

        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "found"
        assert release_process_result["source_map_reference"] == "bundle.min.js.map"
        assert release_process_result["matching_source_map_name"] == "~/bundle.min.js.map"

    @override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 10})
    def test_frame_release_process_artifact_bundle_url_match_by_bundle_wrong_dist(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
                dist="some-dist",
            ),
            project_id=self.project.id,
        )
        self.create_release_artifact_bundle(["~/bundle.min.js"], dist_name="some-dist")
        self.create_release_artifact_bundle(
            ["~/bundle.min.js", "~/bundle.min.js.map"], dist_name="some-other-dist"
        )

        release_process_result = self.get_release_process_result(event.event_id)

        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "wrong-dist"

    @override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 10})
    def test_frame_release_process_artifact_bundle_url_match_by_bundle_not_found(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )
        self.create_release_artifact_bundle(["~/other.min.js", "~/other.min.js.map"])

        release_process_result = self.get_release_process_result(event.event_id)

        assert release_process_result["source_file_lookup_result"] == "unsuccessful"

    def test_frame_release_process_artifact_bundle_url_match_by_bundle_reads_newest_bundles(
        self,
    ) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )
        self.create_release_artifact_bundle(["~/bundle.min.js", "~/bundle.min.js.map"])
        self.create_release_artifact_bundle(["~/other.min.js", "~/other.min.js.map"])

        # Only the newest bundle fits in the budget, and the frame's file is in the older one.
        with override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 3}):
            release_process_result = self.get_release_process_result(event.event_id)
        assert release_process_result["source_file_lookup_result"] == "unsuccessful"

        with override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 4}):
            release_process_result = self.get_release_process_result(event.event_id)
        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "found"

    @override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 2})
    def test_frame_release_process_artifact_bundle_url_match_by_bundle_reads_newest_bundle(
        self,
    ) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )
        self.create_release_artifact_bundle(
            ["~/bundle.min.js", "~/bundle.min.js.map"], artifact_count=3
        )

        release_process_result = self.get_release_process_result(event.event_id)

        # The newest bundle is read even though its files exceed the budget.
        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "found"

    def test_release_bundle_urls_reads_at_most_max_index_rows(self) -> None:
        release = self.create_release(version="some-release")
        self.create_release_artifact_bundle(
            ["~/bundle.min.js", "~/bundle.min.js.map", "~/other.min.js"], artifact_count=3
        )

        with override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 2}):
            release_bundle_urls = get_release_bundle_urls(self.project, release)

        # The newest bundle has more files than the budget, so only part of them is read.
        assert release_bundle_urls is not None
        assert len(release_bundle_urls) == 2

        with override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 0}):
            assert get_release_bundle_urls(self.project, release) is None

    @mock.patch("sentry.api.endpoints.source_map_debug.metrics")
    def test_release_bundle_urls_reports_truncation(self, mock_metrics: mock.MagicMock) -> None:
        release = self.create_release(version="some-release")
        self.create_release_artifact_bundle(["~/bundle.min.js", "~/bundle.min.js.map"])
        self.create_release_artifact_bundle(["~/other.min.js", "~/other.min.js.map"])

        with override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 4}):
            get_release_bundle_urls(self.project, release)
        mock_metrics.incr.assert_called_with(
            "source_map_debug.url_match", tags={"truncated": "false"}
        )
        mock_metrics.distribution.assert_called_with("source_map_debug.url_match.index_rows", 4)

        # Only the newest bundle fits in the budget.
        with override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 3}):
            get_release_bundle_urls(self.project, release)
        mock_metrics.incr.assert_called_with(
            "source_map_debug.url_match", tags={"truncated": "index_rows"}
        )
        mock_metrics.distribution.assert_called_with("source_map_debug.url_match.index_rows", 2)

        # The newest bundle alone has more files than the budget.
        with override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 1}):
            get_release_bundle_urls(self.project, release)
        mock_metrics.incr.assert_called_with(
            "source_map_debug.url_match", tags={"truncated": "index_rows"}
        )
        mock_metrics.distribution.assert_called_with("source_map_debug.url_match.index_rows", 1)

    @override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 10})
    def test_release_bundle_urls_skips_other_projects_bundles(self) -> None:
        release = self.create_release(version="some-release")
        other_project = self.create_project(organization=self.organization)
        self.create_release_artifact_bundle(["~/bundle.min.js", "~/bundle.min.js.map"])
        self.create_release_artifact_bundle(
            ["~/other.min.js", "~/other.min.js.map"], project_id=other_project.id
        )

        release_bundle_urls = get_release_bundle_urls(self.project, release)

        assert release_bundle_urls is not None
        assert set(release_bundle_urls) == {"~/bundle.min.js", "~/bundle.min.js.map"}

    @override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 10})
    @mock.patch("sentry.api.endpoints.source_map_debug.URL_MATCH_MAX_BUNDLES", 1)
    @mock.patch("sentry.api.endpoints.source_map_debug.metrics")
    def test_release_bundle_urls_picks_from_release_newest_bundles(
        self, mock_metrics: mock.MagicMock
    ) -> None:
        release = self.create_release(version="some-release")
        other_project = self.create_project(organization=self.organization)
        self.create_release_artifact_bundle(["~/bundle.min.js", "~/bundle.min.js.map"])
        self.create_release_artifact_bundle(["~/other.min.js"], project_id=other_project.id)

        # The release's newest bundle belongs to another project, so none of the project's
        # bundles are picked.
        assert get_release_bundle_urls(self.project, release) == {}
        mock_metrics.incr.assert_called_once_with(
            "source_map_debug.url_match", tags={"truncated": "max_bundles"}
        )

    @override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 10})
    def test_release_bundle_urls_reads_release_links_without_joins(self) -> None:
        release = self.create_release(version="some-release")
        self.create_release_artifact_bundle(["~/bundle.min.js", "~/bundle.min.js.map"])

        with CaptureQueriesContext(
            connections[router.db_for_read(ReleaseArtifactBundle)]
        ) as queries:
            assert get_release_bundle_urls(self.project, release) is not None

        release_queries = [
            query["sql"]
            for query in queries.captured_queries
            if 'FROM "sentry_releaseartifactbundle"' in query["sql"]
        ]
        # Joining each of the release's links to its project link and bundle takes seconds on
        # releases with many bundles, so the newest links are read on their own first.
        assert len(release_queries) == 1
        assert " JOIN " not in release_queries[0]

    @override_options({"sourcemaps.source-map-debug.url-match-max-index-rows": 10})
    def test_frame_release_process_artifact_bundle_url_match_by_bundle_reads_index_once(
        self,
    ) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frames(
                        [
                            {"abs_path": "http://example.com/bundle.min.js"},
                            {"abs_path": "http://example.com/other.min.js"},
                        ]
                    )
                ],
                release="some-release",
            ),
            project_id=self.project.id,
        )
        self.create_release_artifact_bundle(["~/bundle.min.js", "~/bundle.min.js.map"])

        with CaptureQueriesContext(connections[router.db_for_read(ArtifactBundleIndex)]) as queries:
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                event.event_id,
            )

        frames = resp.data["exceptions"][0]["frames"]
        assert frames[0]["release_process"]["source_file_lookup_result"] == "found"
        assert frames[1]["release_process"]["source_file_lookup_result"] == "unsuccessful"
        # The release's files are read once for both frames, by bundle rather than by URL.
        index_queries = [
            query["sql"]
            for query in queries.captured_queries
            if '"sentry_artifactbundleindex"' in query["sql"]
        ]
        assert len(index_queries) == 1
        conditions = index_queries[0].split(" WHERE ", 1)[1]
        assert '"sentry_artifactbundleindex"."artifact_bundle_id" IN' in conditions
        assert '"url"' not in conditions

    def test_frame_release_file_success(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
                dist="some-dist",
            ),
            project_id=self.project.id,
        )

        release = Release.objects.get(organization=self.organization, version=event.release)
        dist = Distribution.objects.get(name="some-dist", release=release)

        artifact_index = File.objects.create(
            name="artifact-index.json",
            type=ARTIFACT_INDEX_TYPE,
        )

        artifact_index.putfile(
            ContentFile(
                orjson.dumps(
                    {
                        "files": {
                            "~/bundle.min.js": {
                                "type": "minified_source",
                                "archive_ident": ReleaseFile.get_ident(
                                    "release-artifacts.zip", dist.name
                                ),
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                            "~/bundle.min.js.map": {
                                "type": "source_map",
                                "archive_ident": ReleaseFile.get_ident(
                                    "release-artifacts.zip", dist.name
                                ),
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                        },
                    }
                )
            )
        )

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=artifact_index,
            name=ARTIFACT_INDEX_FILENAME,
            ident=ReleaseFile.get_ident(ARTIFACT_INDEX_FILENAME, dist.name),
            dist_id=dist.id,
            artifact_count=2,
        )

        compressed = BytesIO(b"SYSB")
        with zipfile.ZipFile(compressed, "a") as zip_file:
            zip_file.writestr(
                "files/_/_/bundle.min.js",
                b'console.log("hello world");\n//# sourceMappingURL=bundle.min.js.map\n',
            )
            zip_file.writestr("files/_/_/bundle.min.js.map", b"")
            zip_file.writestr(
                "manifest.json",
                orjson.dumps(
                    {
                        "files": {
                            "files/_/_/bundle.min.js": {
                                "url": "~/bundle.min.js",
                                "type": "minified_source",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                            "files/_/_/bundle.min.js.map": {
                                "url": "~/bundle.min.js.map",
                                "type": "source_map",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                        },
                    }
                ).decode(),
            )
        compressed.seek(0)
        release_artifact_bundle = File.objects.create(
            name="release-artifacts.zip", type="release.bundle"
        )
        release_artifact_bundle.putfile(compressed)

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=release_artifact_bundle,
            name="release-artifacts.zip",
            ident=ReleaseFile.get_ident("release-artifacts.zip", dist.name),
            dist_id=dist.id,
            artifact_count=0,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "found"
        assert release_process_result["source_map_lookup_result"] == "found"
        assert release_process_result["source_map_reference"] == "bundle.min.js.map"
        assert release_process_result["matching_source_map_name"] == "~/bundle.min.js.map"

    def test_frame_release_file_wrong_dist(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frame({"abs_path": "http://example.com/bundle.min.js"})
                ],
                release="some-release",
                dist="some-dist",
            ),
            project_id=self.project.id,
        )

        release = Release.objects.get(organization=self.organization, version=event.release)

        artifact_index = File.objects.create(
            name="artifact-index.json",
            type=ARTIFACT_INDEX_TYPE,
        )

        artifact_index.putfile(
            ContentFile(
                orjson.dumps(
                    {
                        "files": {
                            "~/bundle.min.js": {
                                "type": "minified_source",
                                "archive_ident": ReleaseFile.get_ident("release-artifacts.zip"),
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                            "~/bundle.min.js.map": {
                                "type": "source_map",
                                "archive_ident": ReleaseFile.get_ident("release-artifacts.zip"),
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                        },
                    }
                )
            )
        )

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=artifact_index,
            name=ARTIFACT_INDEX_FILENAME,
            ident=ReleaseFile.get_ident(ARTIFACT_INDEX_FILENAME),
            artifact_count=2,
        )

        compressed = BytesIO(b"SYSB")
        with zipfile.ZipFile(compressed, "a") as zip_file:
            zip_file.writestr(
                "files/_/_/bundle.min.js",
                b'console.log("hello world");\n//# sourceMappingURL=bundle.min.js.map\n',
            )
            zip_file.writestr("files/_/_/bundle.min.js.map", b"")
            zip_file.writestr(
                "manifest.json",
                orjson.dumps(
                    {
                        "files": {
                            "files/_/_/bundle.min.js": {
                                "url": "~/bundle.min.js",
                                "type": "minified_source",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                            "files/_/_/bundle.min.js.map": {
                                "url": "~/bundle.min.js.map",
                                "type": "source_map",
                                "headers": {
                                    "content-type": "application/json",
                                },
                            },
                        },
                    }
                ).decode(),
            )
        compressed.seek(0)
        release_artifact_bundle = File.objects.create(
            name="release-artifacts.zip", type="release.bundle"
        )
        release_artifact_bundle.putfile(compressed)

        ReleaseFile.objects.create(
            organization_id=self.organization.id,
            release_id=release.id,
            file=release_artifact_bundle,
            name="release-artifacts.zip",
            ident=ReleaseFile.get_ident("release-artifacts.zip"),
            artifact_count=0,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        release_process_result = resp.data["exceptions"][0]["frames"][0]["release_process"]

        assert release_process_result["source_file_lookup_result"] == "wrong-dist"
        assert release_process_result["source_map_lookup_result"] == "unsuccessful"

    def test_has_scraping_data_flag_true(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[],
                scraping_attempts=[
                    {
                        "url": "https://example.com/bundle0.js",
                        "status": "success",
                    }
                ],
            ),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert resp.data["has_scraping_data"]

    def test_has_scraping_data_flag_false(self) -> None:
        event = self.store_event(
            data=create_event(exceptions=[]),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert not resp.data["has_scraping_data"]

    def test_scraping_result_source_file(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frames(
                        [
                            {"abs_path": "https://example.com/bundle0.js"},
                            {"abs_path": "https://example.com/bundle1.js"},
                            {"abs_path": "https://example.com/bundle2.js"},
                            {"abs_path": "https://example.com/bundle3.js"},
                        ]
                    ),
                ],
                scraping_attempts=[
                    {
                        "url": "https://example.com/bundle0.js",
                        "status": "success",
                    },
                    {
                        "url": "https://example.com/bundle1.js",
                        "status": "not_attempted",
                    },
                    {
                        "url": "https://example.com/bundle2.js",
                        "status": "failure",
                        "reason": "not_found",
                        "details": "Did not find source",
                    },
                ],
            ),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert resp.data["exceptions"][0]["frames"][0]["scraping_process"]["source_file"] == {
            "url": "https://example.com/bundle0.js",
            "status": "success",
        }
        assert resp.data["exceptions"][0]["frames"][1]["scraping_process"]["source_file"] == {
            "url": "https://example.com/bundle1.js",
            "status": "not_attempted",
        }
        assert resp.data["exceptions"][0]["frames"][2]["scraping_process"]["source_file"] == {
            "url": "https://example.com/bundle2.js",
            "status": "failure",
            "reason": "not_found",
            "details": "Did not find source",
        }
        assert resp.data["exceptions"][0]["frames"][3]["scraping_process"]["source_file"] is None

    def test_scraping_result_source_map(self) -> None:
        event = self.store_event(
            data=create_event(
                exceptions=[
                    create_exception_with_frames(
                        frames=[
                            {
                                "abs_path": "./app/index.ts",
                                "data": {"sourcemap": "https://example.com/bundle0.js.map"},
                            },
                            {
                                "abs_path": "./app/index.ts",
                                "data": {"sourcemap": "https://example.com/bundle1.js.map"},
                            },
                            {
                                "abs_path": "./app/index.ts",
                                "data": {"sourcemap": "https://example.com/bundle2.js.map"},
                            },
                            {
                                "abs_path": "./app/index.ts",
                                "data": {"sourcemap": "https://example.com/bundle3.js.map"},
                            },
                        ],
                        raw_frames=[
                            {
                                "abs_path": "https://example.com/bundle0.js",
                            },
                            {
                                "abs_path": "https://example.com/bundle1.js",
                            },
                            {
                                "abs_path": "https://example.com/bundle2.js",
                            },
                            {
                                "abs_path": "https://example.com/bundle3.js",
                            },
                        ],
                    )
                ],
                scraping_attempts=[
                    {
                        "url": "https://example.com/bundle0.js.map",
                        "status": "success",
                    },
                    {
                        "url": "https://example.com/bundle1.js.map",
                        "status": "not_attempted",
                    },
                    {
                        "url": "https://example.com/bundle2.js.map",
                        "status": "failure",
                        "reason": "not_found",
                        "details": "Did not find source",
                    },
                ],
            ),
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        assert resp.data["exceptions"][0]["frames"][0]["scraping_process"]["source_map"] == {
            "url": "https://example.com/bundle0.js.map",
            "status": "success",
        }
        assert resp.data["exceptions"][0]["frames"][1]["scraping_process"]["source_map"] == {
            "url": "https://example.com/bundle1.js.map",
            "status": "not_attempted",
        }
        assert resp.data["exceptions"][0]["frames"][2]["scraping_process"]["source_map"] == {
            "url": "https://example.com/bundle2.js.map",
            "status": "failure",
            "reason": "not_found",
            "details": "Did not find source",
        }
        assert resp.data["exceptions"][0]["frames"][3]["scraping_process"]["source_map"] is None
