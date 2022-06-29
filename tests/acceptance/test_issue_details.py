from datetime import datetime, timedelta
from unittest.mock import patch

import pytz
from django.utils import timezone

from fixtures.page_objects.issue_details import IssueDetailsPage
from sentry.testutils import AcceptanceTestCase, SnubaTestCase
from sentry.utils.samples import load_data

now = datetime.utcnow().replace(tzinfo=pytz.utc)


class IssueDetailsTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
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

    def create_sample_event(self, platform, default=None, sample_name=None, time=None, tags=None):
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

    def test_python_event(self):
        tags = [
            ["server_name", "web02.example.org"],
            ["environment", "staging"],
        ]
        self.create_sample_event(platform="python", tags=tags)
        event = self.create_sample_event(platform="python")
        self.page.visit_issue(self.org.slug, event.group.id)

        # Wait for tag bars to load
        self.browser.wait_until_test_id("loaded-device-name")
        self.browser.snapshot("issue details python")

    def test_python_rawbody_event(self):
        event = self.create_sample_event(platform="python-rawbody")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.move_to('[data-test-id="rich-http-content-body-section-pre"]')
        self.browser.snapshot("issue details python raw body", desktop_only=True)

    def test_python_formdata_event(self):
        event = self.create_sample_event(platform="python-formdata")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details python formdata", desktop_only=True)

    def test_pii_tooltips(self):
        event = self.create_sample_event(platform="pii-tooltips")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details pii tooltips", desktop_only=True)

    def test_cocoa_event(self):
        event = self.create_sample_event(platform="cocoa")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details cocoa", desktop_only=True)

    def test_cocoa_event_frame_line_hover(self):
        event = self.create_sample_event(platform="cocoa")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.wait_until_not(".loading")
        self.browser.move_to(".traceback li:nth-child(2)")
        self.browser.snapshot("issue details cocoa frame line hover", desktop_only=True)

    def test_unity_event(self):
        event = self.create_sample_event(default="unity", platform="csharp")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details unity", desktop_only=True)

    def test_android_event(self):
        event = self.create_sample_event(platform="android")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details android", desktop_only=True)

    def test_android_ndk_event(self):
        event = self.create_sample_event(default="android-ndk", platform="android-ndk")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details android-ndk", desktop_only=True)

    def test_aspnetcore_event(self):
        event = self.create_sample_event(default="aspnetcore", platform="csharp")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details aspnetcore", desktop_only=True)

    def test_javascript_specific_event(self):
        event = self.create_sample_event(platform="javascript")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details javascript - event details", desktop_only=True)

        self.browser.click('[aria-label="curl"]')
        self.browser.snapshot(
            "issue details javascript - event details - curl command", desktop_only=True
        )

    def test_rust_event(self):
        # TODO: This should become its own "rust" platform type
        event = self.create_sample_event(platform="native", sample_name="Rust")
        self.page.visit_issue(self.org.slug, event.group.id)

        self.browser.snapshot("issue details rust", desktop_only=True)

    def test_cordova_event(self):
        event = self.create_sample_event(platform="cordova")
        self.page.visit_issue(self.org.slug, event.group.id)

        self.browser.snapshot("issue details cordova", desktop_only=True)

    def test_stripped_event(self):
        event = self.create_sample_event(platform="pii")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details pii stripped", desktop_only=True)

    def test_empty_exception(self):
        event = self.create_sample_event(platform="empty-exception")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details empty exception", desktop_only=True)

    def test_empty_stacktrace(self):
        event = self.create_sample_event(platform="empty-stacktrace")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details empty stacktrace", desktop_only=True)

    def test_invalid_interfaces(self):
        event = self.create_sample_event(platform="invalid-interfaces")
        self.page.visit_issue(self.org.slug, event.group.id)

        self.browser.click('[data-test-id="event-error-alert"]')
        self.browser.wait_until_test_id("event-error-details")
        self.browser.snapshot("issue details invalid interfaces", desktop_only=True)

    def test_activity_page(self):
        event = self.create_sample_event(platform="python")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.go_to_subtab("Activity")

        self.browser.wait_until_test_id("activity-item")
        self.browser.blur()
        self.browser.snapshot("issue activity python", desktop_only=True)

    def test_resolved(self):
        event = self.create_sample_event(platform="python")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.resolve_issue()

        self.browser.snapshot("issue details resolved", desktop_only=True)

    def test_ignored(self):
        event = self.create_sample_event(platform="python")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.page.ignore_issue()

        self.browser.snapshot("issue details ignored", desktop_only=True)

    def test_exception_and_no_threads_event(self):
        event = self.create_sample_event(platform="exceptions-and-no-threads")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details exceptions and no threads", desktop_only=True)

    def test_exception_with_stack_trace_and_crashed_thread_without_stack_trace_event(self):
        event = self.create_sample_event(
            platform="exception-with-stack-trace-and-crashed-thread-without-stack-trace"
        )
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot(
            "issue details exception with stack trace and crashed thread without stack trace",
            desktop_only=True,
        )

    def test_exception_without_stack_trace_and_crashed_thread_with_stack_trace_event(self):
        event = self.create_sample_event(
            platform="exception-without-stack-trace-and-crashed-thread-with-stack-trace"
        )
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot(
            "issue details exception without stack trace and crashed thread with stack trace",
            desktop_only=True,
        )

    def test_exception_with_stack_trace_and_crashed_thread_with_stack_trace_event(self):
        event = self.create_sample_event(
            platform="exception-with-stack-trace-and-crashed-thread-with-stack-trace"
        )
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot(
            "issue details exception with stack trace and crashed thread with stack trace",
            desktop_only=True,
        )

    def test_python_invalid_json_error(self):
        event = self.create_sample_event(default="python-invalid-json-error", platform="native")
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details invalid json error exception", desktop_only=True)

    def test_exception_with_address_instruction(self):
        event = self.create_sample_event(
            default="exception-with-address-instruction", platform="cocoa"
        )
        self.page.visit_issue(self.org.slug, event.group.id)
        self.browser.snapshot("issue details exception with address instruction", desktop_only=True)
