from sentry.testutils import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test  # TODO(hybrid-cloud): stable=True blocked on actors
class SourceMapDebugEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-event-source-map-debug"

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
