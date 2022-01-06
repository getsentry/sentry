from io import BytesIO

import pytest

from sentry import eventstore
from sentry.lang.native.utils import STORE_CRASH_REPORTS_ALL
from sentry.models import EventAttachment, File
from sentry.testutils.helpers.task_runner import BurstTaskRunner
from sentry.testutils.symbolicator import SymbolicatorTestCase

# IMPORTANT:
# For these tests to run, write `symbolicator.enabled: true` into your
# `~/.sentry/config.yml` and run `sentry devservices up`


@pytest.mark.snuba
class SymbolicatorMinidumpIntegrationTest(SymbolicatorTestCase):
    _FEATURES = {
        "organizations:event-attachments": True,
        "organizations:symbol-sources": False,
        "organizations:custom-symbol-sources": False,
        "organizations:images-loaded-v2": False,
    }

    def test_full_minidump(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        self.upload_symbols(self.get_fixture_path("windows.sym"))

        with self.feature(self._FEATURES):
            with open(self.get_fixture_path("windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {
                        "upload_file_minidump": f,
                        "some_file": ("hello.txt", BytesIO(b"Hello World!")),
                    },
                    {"sentry[logger]": "test-logger"},
                )

        self.insta_snapshot_stacktrace_data(event.data)
        assert event.data.get("logger") == "test-logger"
        # assert event.data.get("extra") == {"foo": "bar"}

        attachments = sorted(
            EventAttachment.objects.filter(event_id=event.event_id), key=lambda x: x.name
        )
        hello, minidump = attachments

        assert hello.name == "hello.txt"
        hello_file = File.objects.get(id=hello.file_id)
        assert hello_file.type == "event.attachment"
        assert hello_file.checksum == "2ef7bde608ce5404e97d5f042f95f89f1c232871"

        assert minidump.name == "windows.dmp"
        minidump_file = File.objects.get(id=minidump.file_id)
        assert minidump_file.type == "event.minidump"
        assert minidump_file.checksum == "74bb01c850e8d65d3ffbc5bad5cabc4668fce247"

    def test_full_minidump_json_extra(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        self.upload_symbols(self.get_fixture_path("windows.sym"))

        with self.feature("organizations:event-attachments"):
            with open(self.get_fixture_path("windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f},
                    {"sentry": '{"logger":"test-logger"}', "foo": "bar"},
                )

        assert event.data.get("logger") == "test-logger"
        assert event.data.get("extra") == {"foo": "bar"}
        # Other assertions are performed by `test_full_minidump`

    def test_full_minidump_invalid_extra(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)
        self.upload_symbols(self.get_fixture_path("windows.sym"))

        with self.feature("organizations:event-attachments"):
            with open(self.get_fixture_path("windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f},
                    {"sentry": "{{{{", "foo": "bar"},  # invalid sentry JSON
                )

        assert not event.data.get("logger")
        assert event.data.get("extra") == {"foo": "bar"}
        # Other assertions are performed by `test_full_minidump`

    def test_missing_dsym(self):
        with self.feature(self._FEATURES):
            with open(self.get_fixture_path("windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f}, {"sentry[logger]": "test-logger"}
                )

        self.insta_snapshot_stacktrace_data(event.data)
        assert not EventAttachment.objects.filter(event_id=event.event_id).exists()

    def test_reprocessing(self):
        self.project.update_option("sentry:store_crash_reports", STORE_CRASH_REPORTS_ALL)

        features = dict(self._FEATURES)
        features["organizations:reprocessing-v2"] = True
        with self.feature(features):
            with open(self.get_fixture_path("windows.dmp"), "rb") as f:
                event = self.post_and_retrieve_minidump(
                    {"upload_file_minidump": f}, {"sentry[logger]": "test-logger"}
                )

            self.insta_snapshot_stacktrace_data(event.data, subname="initial")

            self.upload_symbols(self.get_fixture_path("windows.sym"))

            from sentry.tasks.reprocessing2 import reprocess_group

            with BurstTaskRunner() as burst:
                reprocess_group.delay(project_id=self.project.id, group_id=event.group_id)

            burst(max_jobs=100)

            new_event = eventstore.get_event_by_id(self.project.id, event.event_id)
            assert new_event is not None
            assert new_event.event_id == event.event_id

        self.insta_snapshot_stacktrace_data(new_event.data, subname="reprocessed")

        for event_id in (event.event_id, new_event.event_id):
            (minidump,) = sorted(
                EventAttachment.objects.filter(event_id=new_event.event_id), key=lambda x: x.name
            )

            assert minidump.name == "windows.dmp"
            minidump_file = File.objects.get(id=minidump.file_id)
            assert minidump_file.type == "event.minidump"
            assert minidump_file.checksum == "74bb01c850e8d65d3ffbc5bad5cabc4668fce247"
