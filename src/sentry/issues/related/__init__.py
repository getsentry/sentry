"""This module exports a function to find related issues. It groups them by type."""

from sentry.models.group import Group

from .same_root_cause import same_root_cause_analysis
from .trace_connected import trace_connected_analysis

__all__ = ["find_related_issues"]

RELATED_ISSUES_ALGORITHMS = {
    "same_root_cause": same_root_cause_analysis,
    "trace_connected": trace_connected_analysis,
}


def find_related_issues(group: Group) -> list[dict[str, str | list[int] | dict[str, str]]]:
    related_issues: list[dict[str, str | list[int] | dict[str, str]]] = []
    for key, func in RELATED_ISSUES_ALGORITHMS.items():
        data, meta = func(group)
        related_issues.append({"type": key, "data": data, "meta": meta})

    return related_issues
