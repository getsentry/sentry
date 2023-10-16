from rest_framework import status

from sentry.models.eventerror import EventError
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
class ActionableItemsEndpointTestCase(APITestCase):
    # These tests will not focus on the actual source map debugging functionality as that is covered in
    # test_source_map_debug.py. Instead, these tests will focus on the unique parts of this endpoint including the responses,
    # and how event errors are handled.
    endpoint = "sentry-api-0-event-actionable-items"

    def setUp(self) -> None:
        self.login_as(self.user)
        return super().setUp()

    def test_missing_event(self):
        resp = self.get_error_response(
            self.organization.slug,
            self.project.slug,
            "invalid_id",
            status_code=status.HTTP_404_NOT_FOUND,
        )
        assert resp.data["detail"] == "Event not found"

    def test_orders_event_errors_by_priority(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "release": "my-release",
                "dist": "my-dist",
                "sdk": {
                    "name": "sentry.javascript.browser",
                    "version": "7.3.0",
                },
                "exception": {
                    "values": [
                        {
                            "type": "Error",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "abs_path": "https://example.com/application.js",
                                        "lineno": 1,
                                        "colno": 39,
                                    }
                                ]
                            },
                        }
                    ]
                },
                "errors": [
                    {"type": EventError.INVALID_DATA, "name": "foo"},
                    {"type": EventError.JS_MISSING_SOURCES_CONTENT, "url": "http://example.com"},
                    {"type": EventError.UNKNOWN_ERROR, "name": "bar"},
                ],
            },
            project_id=self.project.id,
            assert_no_errors=False,
        )

        resp = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
        )

        errors = resp.data["errors"]

        # Unknown error should be hidden
        assert len(errors) == 2

        # Missing Error should be first by priority
        missing_error = errors[0]
        invalid_data = errors[1]

        assert missing_error["type"] == EventError.JS_MISSING_SOURCES_CONTENT
        assert invalid_data["type"] == EventError.INVALID_DATA
