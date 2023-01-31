from __future__ import annotations

from typing import Any, Dict, List

from .performance_problem import PerformanceProblem

Span = Dict[str, Any]
PerformanceProblemsMap = Dict[str, PerformanceProblem]
TransactionSpans = List[Span]
