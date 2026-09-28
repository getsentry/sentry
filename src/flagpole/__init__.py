"""
Helpers shared by Flagpole feature flag code in sentry and getsentry.

Flag definitions live in sentry-options-automator and are evaluated by the
sentry-options client; this package no longer evaluates flags itself.
flagpole-schema.json is kept for reference only and is not loaded at runtime.
"""

from __future__ import annotations

from enum import StrEnum


class ExperimentMode(StrEnum):
    SIMPLE = "simple"
    """Simple experiment mode: flag on = active, flag off = control."""

    def get_assignment(self, flag_result: bool) -> str:
        """Map a flag evaluation result to an experiment assignment string."""
        match self:
            case ExperimentMode.SIMPLE:
                return "active" if flag_result else "control"


__all__ = ["ExperimentMode"]
