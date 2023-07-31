from __future__ import annotations

import hashlib
from io import BytesIO
from typing import Any
from zipfile import ZipFile

import pytest

from sentry.issues.grouptype import PerformanceFileIOMainThreadGroupType
from sentry.models.debugfile import create_files_from_dif_zip
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.testutils.performance_issues.event_generators import get_event
from sentry.testutils.silo import region_silo_test
from sentry.utils.performance_issues.detectors.io_main_thread_detector import (
    FileIOMainThreadDetector,
)
from sentry.utils.performance_issues.performance_detection import (
    get_detection_settings,
    run_detector_on_data,
)
from sentry.utils.performance_issues.performance_problem import PerformanceProblem

PROGUARD_SOURCE = b"""\
# compiler: R8
# compiler_version: 2.0.74
# min_api: 16
# pg_map_id: 5b46fdc
# common_typos_disable
# {"id":"com.android.tools.r8.mapping","version":"1.0"}
org.slf4j.helpers.Util$ClassContextSecurityManager -> org.a.b.g$a:
    65:65:void <init>() -> <init>
    67:67:java.lang.Class[] getClassContext() -> a
    69:69:java.lang.Class[] getExtraClassContext() -> a
    65:65:void <init>(org.slf4j.helpers.Util$1) -> <init>
"""


@region_silo_test
@pytest.mark.django_db
class FileIOMainThreadDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self._settings = get_detection_settings()

    def create_proguard(self, uuid):
        with ZipFile(BytesIO(), "w") as f:
            f.writestr(f"proguard/{uuid}.txt", PROGUARD_SOURCE)
            create_files_from_dif_zip(f, project=self.project)

    def find_problems(self, event: dict[str, Any]) -> list[PerformanceProblem]:
        detector = FileIOMainThreadDetector(self._settings, event)
        run_detector_on_data(detector, event)
        return list(detector.stored_problems.values())

    def test_respects_project_option(self):
        project = self.create_project()
        event = get_event("file-io-on-main-thread")
        event["project_id"] = project.id

        settings = get_detection_settings(project.id)
        detector = FileIOMainThreadDetector(settings, event)

        assert detector.is_creation_allowed_for_project(project)

        ProjectOption.objects.set_value(
            project=project,
            key="sentry:performance_issue_settings",
            value={"file_io_on_main_thread_detection_enabled": False},
        )

        settings = get_detection_settings(project.id)
        detector = FileIOMainThreadDetector(settings, event)

        assert not detector.is_creation_allowed_for_project(project)

    def test_detects_file_io_main_thread(self):
        event = get_event("file-io-on-main-thread")

        assert self.find_problems(event) == [
            PerformanceProblem(
                fingerprint=f"1-{PerformanceFileIOMainThreadGroupType.type_id}-153198dd61706844cf3d9a922f6f82543df8125f",
                op="file.write",
                desc="1669031858711_file.txt (4.0 kB)",
                type=PerformanceFileIOMainThreadGroupType,
                parent_span_ids=["b93d2be92cd64fd5"],
                cause_span_ids=[],
                offender_span_ids=["054ba3a374d543eb"],
                evidence_data={
                    "op": "file.write",
                    "parent_span_ids": ["b93d2be92cd64fd5"],
                    "cause_span_ids": [],
                    "offender_span_ids": ["054ba3a374d543eb"],
                },
                evidence_display=[],
            )
        ]

    def test_does_not_detect_file_io_main_thread(self):
        event = get_event("file-io-on-main-thread")
        event["spans"][0]["data"]["blocked_main_thread"] = False

        assert self.find_problems(event) == []

    def test_ignores_nib_files(self):
        event = get_event("file-io-on-main-thread")
        event["spans"][0]["data"]["file.path"] = "somethins/stuff.txt/blah/yup/ios.nib"

        assert self.find_problems(event) == []

    def test_gives_problem_correct_title(self):
        event = get_event("file-io-on-main-thread")
        event["spans"][0]["data"]["blocked_main_thread"] = True
        problem = self.find_problems(event)[0]
        assert problem.title == "File IO on Main Thread"

    def test_duplicate_calls_do_not_change_callstack(self):
        event = get_event("file-io-on-main-thread")
        event["spans"][0]["data"]["blocked_main_thread"] = True
        single_span_problem = self.find_problems(event)[0]
        single_problem_fingerprint = single_span_problem.fingerprint
        event["spans"].append(event["spans"][0])
        double_span_problem = self.find_problems(event)[0]
        assert double_span_problem.title == "File IO on Main Thread"
        assert double_span_problem.fingerprint == single_problem_fingerprint

    def test_file_io_with_proguard(self):
        event = get_event("file-io-on-main-thread-with-obfuscation")
        event["project"] = self.project.id

        uuid = event["debug_meta"]["images"][0]["uuid"]
        self.create_proguard(uuid)

        problem = self.find_problems(event)[0]
        call_stack = b"org.slf4j.helpers.Util$ClassContextSecurityManager.getExtraClassContext"
        hashed_stack = hashlib.sha1(call_stack).hexdigest()
        assert (
            problem.fingerprint
            == f"1-{PerformanceFileIOMainThreadGroupType.type_id}-{hashed_stack}"
        )
        assert problem.title == "File IO on Main Thread"

    def test_parallel_spans_detected(self):
        event = get_event("file-io-on-main-thread-with-parallel-spans")
        problem = self.find_problems(event)[0]
        assert problem.offender_span_ids == ["054ba3a374d543eb", "054ba3a3a4d543ab"]

    def test_parallel_spans_not_detected_when_total_too_short(self):
        event = get_event("file-io-on-main-thread-with-parallel-spans")
        event["spans"][1]["timestamp"] = 1669031858.015

        problems = self.find_problems(event)
        assert len(problems) == 0

    def test_complicated_structure(self):
        event = get_event("file-io-on-main-thread-with-complicated-structure")

        problem = self.find_problems(event)[0]
        assert problem.offender_span_ids == [
            "054ba3a374d543eb",
            "054ba3a3a4d543ab",
            "054ba3a3a4d543cd",
            "054ba3a3a4d543ef",
            "054ba3a3a4d54ab1",
            "054ba3a3a4d54ab2",
            "054ba3a3a4d54ab3",
            "054ba3a3a4d54ab4",
        ]
