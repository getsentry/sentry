from typing import int
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from fixtures.page_objects.issue_details import IssueDetailsPage
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import AcceptanceTestCase, SnubaTestCase
from sentry.testutils.silo import no_silo_test
from sentry.utils.samples import load_data

now = datetime.now(timezone.utc)


@no_silo_test
class IssueDetailsTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        patcher = patch("django.utils.timezone.now", return_value=now)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.user = self.create_user("foo@example.com")
        self.org = self.create_organization(owner=self.user, name="Rowdy Tiger")
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.project = self.create_project(organization=self.org, teams=[self.team], name="Bengal")
        self.login_as(self.user)
        self.page = IssueDetailsPage(self.browser, self.client)
        self.dismiss_assistant()

    def create_sample_event(
        self,
        platform: str,
        default: str | None = None,
        sample_name: str | None = None,
        time: datetime | None = None,
        tags: list[list[str]] | None = None,
    ) -> Event:
        event_data = load_data(platform, default=default, sample_name=sample_name)
        event_data["event_id"] = "d964fdbd649a4cf8bfc35d18082b6b0e"

        # Only set these properties if we were given a time.
        # event processing will mark old time values as processing errors.
        if time:
            event_data["received"] = time.isoformat()
        if tags:
            event_data["tags"] = tags

        # We need a fallback datetime for the event
        if time is None:
            time = now - timedelta(days=2)
            time = time.replace(hour=0, minute=0, second=0, microsecond=0)

        event_data["timestamp"] = time.isoformat()
        event = self.store_event(
            data=event_data, project_id=self.project.id, assert_no_errors=False
        )
        event.group.update(
            first_seen=datetime(2015, 8, 13, 3, 8, 25, tzinfo=timezone.utc), last_seen=time
        )
        return event

    def test_python_event(self) -> None:
        tags = [
            ["server_name", "web02.example.org"],
            ["environment", "staging"],
        ]
        self.create_sample_event(platform="python", tags=tags)
        event = self.create_sample_event(platform="python")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

        # Wait for tag bars to load
        self.browser.wait_until_test_id("loaded-device-name")

    def test_python_rawbody_event(self) -> None:
        event = self.create_sample_event(platform="python-rawbody")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.move_to('[data-test-id="rich-http-content-body-section-pre"]')

    def test_python_formdata_event(self) -> None:
        event = self.create_sample_event(platform="python-formdata")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_pii_tooltips(self) -> None:
        event = self.create_sample_event(platform="pii-tooltips")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_cocoa_event(self) -> None:
        event = self.create_sample_event(platform="cocoa")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_cocoa_event_frame_line_hover(self) -> None:
        event = self.create_sample_event(platform="cocoa")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.wait_until_not(".loading")
        self.browser.move_to(".traceback li:nth-child(2)")

    def test_unity_event(self) -> None:
        event = self.create_sample_event(default="unity", platform="csharp")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_android_event(self) -> None:
        event = self.create_sample_event(platform="android")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_android_ndk_event(self) -> None:
        event = self.create_sample_event(default="android-ndk", platform="android-ndk")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_aspnetcore_event(self) -> None:
        event = self.create_sample_event(default="aspnetcore", platform="csharp")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_javascript_specific_event(self) -> None:
        event = self.create_sample_event(platform="javascript")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

        self.browser.click('label[data-test-id="curl"]')

    def test_rust_event(self) -> None:
        # TODO: This should become its own "rust" platform type
        event = self.create_sample_event(platform="native", sample_name="Rust")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_cordova_event(self) -> None:
        event = self.create_sample_event(platform="cordova")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_stripped_event(self) -> None:
        event = self.create_sample_event(platform="pii")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_empty_exception(self) -> None:
        event = self.create_sample_event(platform="empty-exception")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_empty_stacktrace(self) -> None:
        event = self.create_sample_event(platform="empty-stacktrace")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_activity_page(self) -> None:
        event = self.create_sample_event(platform="python")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.go_to_subtab("activity")

        self.browser.wait_until_test_id("activity-item")

    def test_resolved(self) -> None:
        event = self.create_sample_event(platform="python")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.resolve_issue()

    def test_archived(self) -> None:
        event = self.create_sample_event(platform="python")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.archive_issue()

    def test_exception_and_no_threads_event(self) -> None:
        event = self.create_sample_event(platform="exceptions-and-no-threads")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_exception_with_stack_trace_and_crashed_thread_without_stack_trace_event(self) -> None:
        event = self.create_sample_event(
            platform="exception-with-stack-trace-and-crashed-thread-without-stack-trace"
        )
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_exception_without_stack_trace_and_crashed_thread_with_stack_trace_event(self) -> None:
        event = self.create_sample_event(
            platform="exception-without-stack-trace-and-crashed-thread-with-stack-trace"
        )
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_exception_with_stack_trace_and_crashed_thread_with_stack_trace_event(self) -> None:
        event = self.create_sample_event(
            platform="exception-with-stack-trace-and-crashed-thread-with-stack-trace"
        )
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_python_invalid_json_error(self) -> None:
        event = self.create_sample_event(default="python-invalid-json-error", platform="native")
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)

    def test_exception_with_address_instruction(self) -> None:
        event = self.create_sample_event(
            default="exception-with-address-instruction", platform="cocoa"
        )
        assert event.group is not None
        self.page.visit_issue(self.org.slug, event.group.id)
