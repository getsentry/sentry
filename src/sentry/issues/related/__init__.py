"""This module exports a function to find related issues. It groups them by type."""

from sentry.models.group import Group

from .same_root_cause import same_root_cause_analysis
from .trace_connected import trace_connected_analysis

__all__ = ["find_related_issues"]

RELATED_ISSUES_ALGORITHMS = {
    "same_root_cause": same_root_cause_analysis,
    "trace_connected": trace_connected_analysis,
}


def find_related_issues(group: Group) -> list[dict[str, list[int] | str]]:
    related_issues: list[dict[str, list[int] | str]] = []
    for key, func in RELATED_ISSUES_ALGORITHMS.items():
        related_issues.append({"type": key, "data": func(group)})

    return related_issues
