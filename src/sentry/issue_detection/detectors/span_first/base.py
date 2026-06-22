from __future__ import annotations

import builtins
from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import Any, ClassVar

from sentry.issue_detection.base import DetectorType
from sentry.issue_detection.performance_problem import PerformanceProblem
from sentry.issue_detection.types import StandaloneSpan
from sentry.issues.grouptype import GroupType


class SpanFirstDetector(ABC):
    """
    Base class for span-first performance detectors.

    Subclasses are driven by `run_detector` in this package's `__init__.py`: one `visit_span` call
    per span in the segment (root included), in input order, followed by a single `on_complete`
    call. Whatever ends up in `self.stored_problems` after that is the detector's output.

    Concrete subclasses must set the two class attributes `type` and `grouptype`, and implement
    `visit_span`. The default `on_complete` is a no-op (override if finalization is needed). The
    default `is_creation_allowed` returns the configured `detection_enabled` flag (override for
    more nuanced gating).
    """

    # The detector type, used to look up settings and label metrics. Shares the type id of the
    # legacy detector, so the two pull from the same settings entry.
    type: ClassVar[DetectorType]

    # The `GroupType` subclass this detector emits. Multiple detectors may share a grouptype
    # (e.g. N+1 and MN+1 both emit instances of `PerformanceNPlusOneGroupType`), in which case the
    # orchestrator buckets them together so siblings run as a unit.
    # (Note: We have to namespace `type` here because of the `type` classvar defined above. Longterm
    # we might investigate if we can avoid shadowing the built-in there.)
    grouptype: ClassVar[builtins.type[GroupType]]

    def __init__(
        self,
        settings: dict[str, Any],
        segment_span: StandaloneSpan,
        segment: Sequence[StandaloneSpan],
        detector_id: int | None = None,
    ) -> None:
        self._settings = settings
        self._segment_span = segment_span
        self._detector_id = detector_id
        self.stored_problems: dict[str, PerformanceProblem] = {}

    @abstractmethod
    def visit_span(self, span: StandaloneSpan) -> None:
        """
        Called once for each span in the segment, in input order (segment root first). Detectors
        collect any problems they identify into `self.stored_problems`, keyed by fingerprint.
        """

    def on_complete(self) -> None:
        """
        Called once after all spans have been visited. Detectors override this hook to finalize
        any state and emit any problems whose detection spans the whole segment (rather than a
        single span). Default is a no-op for detectors that emit per-span.
        """
        pass

    def is_creation_allowed(self) -> bool:
        """
        Returns whether this detector is allowed to emit problems. By deefault, reads
        `detection_enabled` from settings; override for more nuanced gating.
        """
        return self._settings["detection_enabled"]
