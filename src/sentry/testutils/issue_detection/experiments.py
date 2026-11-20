from typing import Any
from unittest.mock import patch

from sentry.issue_detection.performance_detection import DETECTOR_CLASSES
from sentry.testutils.cases import TestCase


def exclude_experimental_detectors(cls: type[TestCase]) -> type[TestCase]:
    """
    Modifies the setUp method of a given TestCase to exclude any experimental detectors. It does so
    by patching the DETECTOR_CLASSES variable, which is read by methods like `_detect_performance_problems`.

    Use as a decorator for the TestCase class:
    ```
    @exclude_experimental_detectors
    class SomeTestCase(TestCase):
        ...
    ```
    """
    cls_setUp = cls.setUp

    def exclude_experimental_detectors_setUp(
        self: TestCase,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        patch_detector_classes = patch(
            "sentry.issue_detection.performance_detection.DETECTOR_CLASSES",
            [cls for cls in DETECTOR_CLASSES if "Experimental" not in cls.__name__],
        )
        patch_detector_classes.start()
        self.addCleanup(patch_detector_classes.stop)
        cls_setUp(self, *args, **kwargs)

    cls.setUp = exclude_experimental_detectors_setUp  # type: ignore[assignment]
    return cls
