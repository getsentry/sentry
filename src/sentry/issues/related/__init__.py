"""This module exports a function to find related issues. It groups them by type."""

from .same_root_cause import same_root_cause_analysis
from .trace_connected import trace_connected_analysis

__all__ = ["find_related_issues", "same_root_cause_analysis", "trace_connected_analysis"]

RELATED_ISSUES_ALGORITHMS = {
    "same_root_cause": same_root_cause_analysis,
    "trace_connected": trace_connected_analysis,
}
