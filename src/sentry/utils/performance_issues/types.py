from __future__ import annotations

from typing import Any

from .performance_problem import PerformanceProblem

Span = dict[str, Any]
PerformanceProblemsMap = dict[str, PerformanceProblem]
TransactionSpans = list[Span]
