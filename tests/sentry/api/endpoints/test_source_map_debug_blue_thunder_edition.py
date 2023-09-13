from django.core.files.base import ContentFile
from rest_framework import status

from sentry.models import Distribution, File, Release, ReleaseFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


def create_exception_with_frame(frame):
    return {
        "type": "Error",
        "stacktrace": {"frames": [frame]},
    }


def create_event(exceptions=None, debug_meta_images=None, sdk=None, release=None):
    exceptions = [] if exceptions is None else exceptions
    return {
        "event_id": "a" * 32,
        "release": release,
        "exception": {"values": exceptions},
        "debug_meta": None if debug_meta_images is None else {"images": debug_meta_images},
        "sdk": sdk,
    }


@region_silo_test  # TODO(hybrid-cloud): stable=True blocked on actors
class SourceMapDebugBlueThunderEditionEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-event-source-map-debug-blue-thunder-edition"

    def setUp(self) -> None:
        self.login_as(self.user)
        return super().setUp()

    def test_missing_event(self):
        with self.feature("organizations:source-maps-debugger-blue-thunder-edition"):
            resp = self.get_error_response(
                self.organization.slug,
                self.project.slug,
                "invalid_id",
                frame_idx=0,
                exception_idx=0,
                status_code=status.HTTP_404_NOT_FOUND,
            )
            assert resp.data["detail"] == "Event not found"

    def test_empty_exceptions_array(self):
        with self.feature("organizations:source-maps-debugger-blue-thunder-edition"):
            event = self.store_event(data=create_event([]), project_id=self.project.id)
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                event.event_id,
            )
            assert resp.data["exceptions"] == []

    def test_has_debug_ids_true(self):
        with self.feature("organizations:source-maps-debugger-blue-thunder-edition"):
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

    def test_has_debug_ids_false(self):
        with self.feature("organizations:source-maps-debugger-blue-thunder-edition"):
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

    def test_sdk_version(self):
        with self.feature("organizations:source-maps-debugger-blue-thunder-edition"):
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

    def test_no_sdk_version(self):
        with self.feature("organizations:source-maps-debugger-blue-thunder-edition"):
            event = self.store_event(data=create_event(), project_id=self.project.id)
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                event.event_id,
            )
            assert resp.data["sdk_version"] is None

    def test_sdk_debug_id_support_full(self):
        with self.feature("organizations:source-maps-debugger-blue-thunder-edition"):
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

    def test_sdk_debug_id_support_needs_upgrade(self):
        with self.feature("organizations:source-maps-debugger-blue-thunder-edition"):
            event = self.store_event(
                data=create_event(sdk={"name": "sentry.javascript.react", "version": "7.47.0"}),
                project_id=self.project.id,
            )
            resp = self.get_success_response(
                self.organization.slug,
                self.project.slug,
                event.event_id,
            )
            assert resp.data["sdk_debug_id_support"] == "needs-upgrade"

    def test_sdk_debug_id_support_unsupported(self):
        with self.feature("organizations:source-maps-debugger-blue-thunder-edition"):
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

    def test_sdk_debug_id_support_community_sdk(self):
        with self.feature("organizations:source-maps-debugger-blue-thunder-edition"):
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

    def test_release_has_some_artifact_positive(self):
        # TODO
        return

    def test_release_has_some_artifact_negative(self):
        # TODO
        return

    def test_project_has_some_artifact_bundle_positive(self):
        # TODO
        return

    def test_project_has_some_artifact_bundle_negative(self):
        # TODO
        return

    def test_project_has_some_artifact_bundle_with_a_debug_id_positive(self):
        # TODO
        return

    def test_project_has_some_artifact_bundle_with_a_debug_id_negative(self):
        # TODO
        return

    def test_multiple_exceptions(self):
        # TODO
        return

    def test_frame_debug_id_no_debug_id(self):
        # TODO
        return

    def test_frame_debug_id_no_uploaded_source_no_uploaded_source_map(self):
        # TODO
        return

    def test_frame_debug_id_uploaded_source_no_uploaded_source_map(self):
        # TODO
        return

    def test_frame_debug_id_no_uploaded_source_uploaded_source_map(self):
        # TODO
        return

    def test_frame_debug_id_uploaded_source_uploaded_source_map(self):
        # TODO
        return

    def test_frame_release_matching_source_file_names(self):
        # TODO
        return

    def test_frame_release_source_map_reference(self):
        # TODO
        return

    def test_frame_release_data_protocol_source_map_reference(self):
        # TODO
        return

    def test_frame_release_source_file_not_found(self):
        # TODO
        return

    def test_frame_release_source_file_wrong_dist(self):
        # TODO
        return

    def test_frame_release_source_file_successful(self):
        # TODO
        return

    def test_frame_release_source_map_not_found(self):
        # TODO
        return

    def test_frame_release_source_map_wrong_dist(self):
        # TODO
        return

    def test_frame_release_source_map_successful(self):
        # TODO
        return
