"""The confirmed-green tip, handed from ``base`` to the side-effect modules.

Its own module so the package's imports stay one-way: ``base`` imports the side
effects in order to run them, and the side effects import only this. Keeping the
context next to ``GreenCheckSuite`` instead would make that pair circular.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

from scm.manager import SourceCodeManager
from scm.types import ActionResult, PullRequest

if TYPE_CHECKING:
    from sentry.seer.autofix.pr_iteration.green_check_suite.base import GreenCheckSuite


@dataclass(frozen=True)
class GreenCheckSuiteContext:
    """Confirmed-green tip after SCM live-head match + check-run sweep."""

    resolved: GreenCheckSuite
    scm: SourceCodeManager
    pull_request: ActionResult[PullRequest]
    head_sha: str
