from __future__ import annotations

from enum import StrEnum

from sentry.seer.autofix.utils import AutofixStoppingPoint


class AutofixStep(StrEnum):
    """Available autofix steps."""

    ROOT_CAUSE = "root_cause"
    SOLUTION = "solution"
    CODE_CHANGES = "code_changes"
    PR_ITERATION = "pr_iteration"

    @staticmethod
    def from_autofix_stopping_point(
        autofix_stopping_point: AutofixStoppingPoint,
    ) -> AutofixStep:
        match autofix_stopping_point:
            case AutofixStoppingPoint.ROOT_CAUSE:
                return AutofixStep.ROOT_CAUSE
            case AutofixStoppingPoint.SOLUTION:
                return AutofixStep.SOLUTION
            case AutofixStoppingPoint.CODE_CHANGES:
                return AutofixStep.CODE_CHANGES
            case AutofixStoppingPoint.OPEN_PR:
                # This depends on the last step being
                # code changes and we should look for
                # the PR elsewhere in the agent results
                return AutofixStep.CODE_CHANGES
            case _:
                raise ValueError(f"Unsupported AutofixStoppingPoint: {autofix_stopping_point}")
