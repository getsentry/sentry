"""Per-section size limits. Sections apply these caps
as they render, so output stays bounded. ``None`` means no cap; ``max_frames``/
``max_breadcrumbs``/``max_threads`` are count caps.
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
    max_contexts_chars: int | None = None
    max_evidence_chars: int | None = None
    max_frames: int = 16
    max_breadcrumbs: int = 10
    max_threads: int = 8


LIMITS_DEFAULT = Limits(
    max_exceptions_chars=100_000,
    max_stacktrace_chars=20_000,
    max_spans_chars=5_000,
    max_contexts_chars=5_000,
    max_evidence_chars=5_000,
)

# tighter caps for token-constrained callers, and the only profile that caps breadcrumbs and the
# request body at all
LIMITS_LOW = Limits(
    max_exceptions_chars=50_000,
    max_stacktrace_chars=10_000,
    max_breadcrumbs_chars=5_000,
    max_single_breadcrumb_chars=500,
    max_request_chars=2_000,
    max_spans_chars=5_000,
    max_contexts_chars=2_000,
    max_evidence_chars=2_000,
)
