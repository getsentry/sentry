from rest_framework import status

from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test  # TODO(hybrid-cloud): stable=True blocked on actors
class ProjectOwnershipEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-event-source-map-debug"

    def setUp(self) -> None:
        self.login_as(self.user)
        return super().setUp()

    def test_no_feature_flag(self):
        event = self.store_event(
            data={"event_id": "a" * 32},
            project_id=self.project.id,
        )
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            frame=0,
            status_code=status.HTTP_404_NOT_FOUND,
        )
        assert (
            resp.data["detail"]
            == "Endpoint not available without 'organizations:fix-source-map-cta' feature flag"
        )

    @with_feature("organizations:fix-source-map-cta")
    def test_missing_event(self):
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            "invalid_id",
            frame_idx=0,
            status_code=status.HTTP_404_NOT_FOUND,
        )
        assert resp.data["detail"] == "Event not found"

    @with_feature("organizations:fix-source-map-cta")
    def test_no_frame_given(self):
        event = self.store_event(
            data={"event_id": "a" * 32, "release": "my-release"}, project_id=self.project.id
        )
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            status_code=status.HTTP_400_BAD_REQUEST,
        )
        assert resp.data["detail"] == "Query parameter 'frame_idx' is required"

    @with_feature("organizations:fix-source-map-cta")
    def test_no_errors(self):
        event = self.store_event(
            data={"event_id": "a" * 32, "release": "my-release"}, project_id=self.project.id
        )
        resp = self.get_success_response(
            self.organization.slug, self.project.slug, event.event_id, frame_idx=0
        )
        assert resp.data["errors"] == []

    @with_feature("organizations:fix-source-map-cta")
    def test_event_has_no_release(self):
        event = self.store_event(
            data={"event_id": "a" * 32},
            project_id=self.project.id,
        )

        resp = self.get_success_response(
            self.organization.slug, self.project.slug, event.event_id, frame_idx=0
        )
        error = resp.data["errors"][0]
        assert error["type"] == "no_release_on_event"
        assert error["message"] == "The event is missing a release"
