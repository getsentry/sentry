from django.core.files.base import ContentFile
from rest_framework import status

from sentry.models import Distribution, File, Release, ReleaseFile
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test  # TODO(hybrid-cloud): stable=True blocked on actors
class SourceMapDebugBlueThunderEditionEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-event-source-map-debug-blue-thunder-edition"

    base_data = {
        "event_id": "a" * 32,
        "exception": {
            "values": [
                {
                    "type": "Error",
                    "stacktrace": {
                        "frames": [
                            {
                                "abs_path": "https://app.example.com/static/js/main.fa8fe19f.js",
                                "filename": "/static/js/main.fa8fe19f.js",
                                "lineno": 1,
                                "colno": 39,
                                "context_line": "function foo() {",
                            }
                        ]
                    },
                },
            ]
        },
    }

    def setUp(self) -> None:
        self.login_as(self.user)
        return super().setUp()

    def test_missing_event(self):
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            "invalid_id",
            frame_idx=0,
            exception_idx=0,
            status_code=status.HTTP_404_NOT_FOUND,
        )
        assert resp.data["detail"] == "Event not found"

    def test_no_exception(self):
        # TODO
        return

    def test_has_debug_ids_true(self):
        # TODO
        return

    def test_has_debug_ids_false(self):
        # TODO
        return

    def test_sdk_version(self):
        # TODO
        return

    def test_no_sdk_version(self):
        # TODO
        return

    def test_sdk_debug_id_support_full(self):
        # TODO
        return

    def test_sdk_debug_id_support_needs_upgrade(self):
        # TODO
        return

    def test_sdk_debug_id_support_unsupported(self):
        # TODO
        return

    def test_sdk_debug_id_support_community_sdk(self):
        # TODO
        return

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
