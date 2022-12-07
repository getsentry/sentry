import hashlib
from io import BytesIO
from zipfile import ZipFile

import pytest

from sentry.models import create_files_from_dif_zip
from sentry.testutils import TestCase
from sentry.testutils.performance_issues.event_generators import EVENTS
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from sentry.utils.performance_issues.performance_detection import (
    FileIOMainThreadDetector,
    get_detection_settings,
    run_detector_on_data,
)

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
class NPlusOneAPICallsDetectorTest(TestCase):
    def setUp(self):
        super().setUp()
        self.settings = get_detection_settings()

    def create_proguard(self, uuid):
        with ZipFile(BytesIO(), "w") as f:
            f.writestr(f"proguard/{uuid}.txt", PROGUARD_SOURCE)
            create_files_from_dif_zip(f, project=self.project)

    def test_gives_problem_correct_title(self):
        event = EVENTS["file-io-on-main-thread"]

        detector = FileIOMainThreadDetector(self.settings, event)
        run_detector_on_data(detector, event)
        problem = list(detector.stored_problems.values())[0]
        assert problem.title == "File IO on Main Thread"

    def test_file_io_with_proguard(self):
        event = EVENTS["file-io-on-main-thread-with-obfuscation"]
        event["project"] = self.project.id

        uuid = event["debug_meta"]["images"][0]["uuid"]
        self.create_proguard(uuid)

        detector = FileIOMainThreadDetector(self.settings, event)
        run_detector_on_data(detector, event)
        problem = list(detector.stored_problems.values())[0]
        call_stack = b"org.slf4j.helpers.Util$ClassContextSecurityManager.getExtraClassContext"
        hashed_stack = hashlib.sha1(call_stack).hexdigest()
        assert (
            problem.fingerprint == f"1-{GroupType.PERFORMANCE_FILE_IO_MAIN_THREAD}-{hashed_stack}"
        )
        assert problem.title == "File IO on Main Thread"

    def test_parallel_spans(self):
        event = EVENTS["file-io-on-main-thread-with-parallel-spans"]

        detector = FileIOMainThreadDetector(self.settings, event)
        run_detector_on_data(detector, event)
        problem = list(detector.stored_problems.values())[0]
        assert detector._total_span_time(
            detector.parent_to_blocked_span["b93d2be92cd64fd5"]
        ) == pytest.approx(16, 0.01)
        assert problem.offender_span_ids == ["054ba3a374d543eb", "054ba3a3a4d543ab"]

    def test_parallel_spans_not_detected_when_total_too_short(self):
        event = EVENTS["file-io-on-main-thread-with-parallel-spans"]
        event["spans"][1]["timestamp"] = 1669031858.015

        detector = FileIOMainThreadDetector(self.settings, event)
        run_detector_on_data(detector, event)
        assert len(detector.stored_problems) == 0

    def test_complicated_structure(self):
        event = EVENTS["file-io-on-main-thread-with-complicated-structure"]

        detector = FileIOMainThreadDetector(self.settings, event)
        run_detector_on_data(detector, event)
        problem = list(detector.stored_problems.values())[0]
        assert detector._total_span_time(
            detector.parent_to_blocked_span["b93d2be92cd64fd5"]
        ) == pytest.approx(16, 0.01)
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
