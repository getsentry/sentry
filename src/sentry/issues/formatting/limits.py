"""Per-section size limits, mirroring Seer's ``EventFormatLimits``. Sections apply these caps
as they render, so output stays bounded. ``None`` means no cap; ``max_frames``/
``max_breadcrumbs`` are count caps.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Limits:
    max_exceptions_chars: int | None = None
    max_stacktrace_chars: int | None = None
    max_request_chars: int | None = None
    max_breadcrumbs_chars: int | None = None
    max_single_breadcrumb_chars: int | None = None
    max_spans_chars: int | None = None
    max_frames: int = 16
    max_breadcrumbs: int = 10


LIMITS_DEFAULT = Limits(
    max_exceptions_chars=100_000,
    max_stacktrace_chars=20_000,
    max_spans_chars=5_000,
)
