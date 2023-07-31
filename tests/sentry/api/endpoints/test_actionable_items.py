from sentry.api.helpers.actionable_items_helper import get_file_extension, is_frame_filename_invalid
from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ActionableItemsEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-event-actionable-items"

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

    def test_get_file_extension(self):
        cases = [("foo.js", "js"), ("foo.spec.js", "js"), ("foo", None)]
        for filename, expected in cases:
            assert get_file_extension(filename) == expected

    def test_is_frame_filename_invalid(self):
        cases = [
            (
                {
                    "abs_path": "https://app.example.com/static/js/main.fa8fe19f.js",
                    "filename": "<anonymous>",
                    "in_app": True,
                },
                True,
            ),
            (
                {
                    "abs_path": "https://app.example.com/static/js/main.fa8fe19f.js",
                    "function": "@webkit-masked-url",
                },
                True,
            ),
            (
                {
                    "abs_path": "https://app.example.com/static/js/main",
                },
                True,
            ),
            (
                {
                    "abs_path": "https://app.example.com/static/js/main.fa8fe19f.js",
                },
                False,
            ),
        ]

        for frame, expected in cases:
            assert is_frame_filename_invalid(frame) == expected
