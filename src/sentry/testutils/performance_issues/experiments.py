from unittest.mock import patch

from sentry.performance_issues.performance_detection import DETECTOR_CLASSES
from sentry.testutils.cases import TestCase


def exclude_experimental_detectors(cls: type[TestCase]):
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

    def exclude_experimental_detectors_setUp(self, *args, **kwargs):
        self.patch_detector_classes = patch(
            "sentry.performance_issues.performance_detection.DETECTOR_CLASSES",
            [cls for cls in DETECTOR_CLASSES if "Experimental" not in cls.__name__],
        )
        self.patch_detector_classes.start()
        self.addCleanup(self.patch_detector_classes.stop)
        cls_setUp(self, *args, **kwargs)

    cls.setUp = exclude_experimental_detectors_setUp  # type: ignore[method-assign]
    return cls
