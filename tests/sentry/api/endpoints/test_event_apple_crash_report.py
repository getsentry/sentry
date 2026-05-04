from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


def _stacktrace(package: str) -> dict:
    return {
        "frames": [
            {
                "image_addr": "0x2c8000",
                "instruction_addr": "0x31c3e8",
                "symbol_addr": "0x31b9f8",
                "package": package,
            }
        ]
    }


class EventAppleCrashReportTest(APITestCase):
    endpoint = "sentry-api-0-event-apple-crash-report"

    def test_prioritizes_thread_id(self) -> None:
        self.login_as(self.user)
        event = self.store_event(
            data={
                "platform": "native",
                "timestamp": before_now(minutes=1).isoformat(),
                "exception": {
                    "values": [
                        {
                            "type": "EXC_BAD_ACCESS",
                            "thread_id": 1874743,
                            "mechanism": {"type": "mach"},
                            "stacktrace": _stacktrace("/path/to/App.framework/App"),
                        }
                    ]
                },
                "threads": {
                    "values": [
                        {"id": 1874743},
                        {
                            "id": 965139,
                            "stacktrace": _stacktrace("/path/to/Worker.framework/Worker"),
                        },
                    ]
                },
            },
            project_id=self.project.id,
        )

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            event.event_id,
            qs_params={"thread_id": "1874743"},
        )
        body = response.content.decode()

        assert body.index("Thread 1874743") < body.index("Thread 965139")
