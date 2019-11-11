from __future__ import absolute_import
import os

from symbolic import Unreal4Crash

from sentry.testutils import TestCase
from sentry.lang.native.minidump import MINIDUMP_ATTACHMENT_TYPE
from sentry.lang.native.unreal import (
    merge_unreal_user,
    unreal_attachment_type,
    merge_unreal_context_event,
    merge_unreal_logs_event,
)
from sentry.models import UserReport


MOCK_EVENT_ID = "12852a74acc943a790c8f1cd23907caa"


def get_fixture_path(name):
    return os.path.join(
        os.path.dirname(__file__), os.pardir, os.pardir, os.pardir, "fixtures", "native", name
    )


def get_unreal_crash_file():
    return get_fixture_path("unreal_crash")


def test_unreal_attachment_type_minidump():
    file = MockFile("minidump")
    assert unreal_attachment_type(file) == MINIDUMP_ATTACHMENT_TYPE


def test_unreal_attachment_type_unknown():
    file = MockFile("something unknown")
    assert unreal_attachment_type(file) is None


class MockFile(TestCase):
    def __init__(self, type):
        self.type = type


class UnrealIntegrationTest(TestCase):
    def test_merge_unreal_context_event(self):
        with open(get_unreal_crash_file(), "rb") as f:
            event = {"event_id": MOCK_EVENT_ID, "environment": "Production"}
            user_id = "ebff51ef3c4878627823eebd9ff40eb4|2e7d369327054a448be6c8d3601213cb|C52DC39D-DAF3-5E36-A8D3-BF5F53A5D38F"
            merge_unreal_user(event, user_id)
            unreal_crash = Unreal4Crash.from_bytes(f.read())
            merge_unreal_context_event(unreal_crash.get_context(), event, self.project)
            self.insta_snapshot(event)

    def test_merge_unreal_context_event_without_user(self):
        expected_message = "user comments"
        context = {"runtime_properties": {"user_description": expected_message}}
        event = {"event_id": MOCK_EVENT_ID}
        merge_unreal_context_event(context, event, self.project)

        user_report = UserReport.objects.get(event_id=MOCK_EVENT_ID, project=self.project)
        assert user_report.comments == expected_message
        assert user_report.name == "unknown"
        assert event.get("user") is None

    def test_merge_unreal_context_event_with_user(self):
        expected_message = "user comments"
        expected_username = "John Doe"
        context = {
            "runtime_properties": {
                "username": expected_username,
                "user_description": expected_message,
            }
        }
        event = {"event_id": MOCK_EVENT_ID}
        merge_unreal_context_event(context, event, self.project)

        user_report = UserReport.objects.get(event_id=event["event_id"], project=self.project)
        assert user_report.comments == expected_message
        assert user_report.name == expected_username
        assert event["user"]["username"] == expected_username

    def test_merge_unreal_context_event_without_user_description(self):
        expected_username = "Jane Bloggs"
        context = {"runtime_properties": {"username": expected_username}}
        event = {"event_id": MOCK_EVENT_ID}
        merge_unreal_context_event(context, event, self.project)
        try:
            user_report = UserReport.objects.get(event_id=MOCK_EVENT_ID, project=self.project)
        except UserReport.DoesNotExist:
            user_report = None

        assert user_report is None
        assert event["user"]["username"] == expected_username

    def test_merge_unreal_logs_event(self):
        with open(get_unreal_crash_file(), "rb") as f:
            event = {"event_id": MOCK_EVENT_ID, "environment": None}
            unreal_crash = Unreal4Crash.from_bytes(f.read())
            merge_unreal_logs_event(unreal_crash.get_logs(), event)
            breadcrumbs = event["breadcrumbs"]["values"]
            assert len(breadcrumbs) == 100
            assert breadcrumbs[0]["timestamp"] == "2018-11-20T11:47:14Z"
            assert breadcrumbs[0]["message"] == "   4. 'Parallels Display Adapter (WDDM)' (P:0 D:0)"
            assert breadcrumbs[0]["category"] == "LogWindows"
            assert breadcrumbs[99]["timestamp"] == "2018-11-20T11:47:15Z"
            assert breadcrumbs[99]["message"] == "Texture pool size now 1000 MB"
            assert breadcrumbs[99]["category"] == "LogContentStreaming"
