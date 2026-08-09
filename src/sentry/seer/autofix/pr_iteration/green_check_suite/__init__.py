"""CI-green handling for a Seer-authored PR: undraft it, then ask for review.

``GreenCheckSuite`` (``base``) owns the whole green path: it gates on whether
either side effect still has work, confirms the tip is really green once, and
then dispatches to the two side effects, which are only ever reached through
``handle()``. Each side effect has its own module, its own lock and its own
sticky ``SeerRun.extras`` marker, and they succeed, fail, and retry
independently of one another.

The marker semantics differ, and the difference matters — see the module
docstrings of ``ready_for_review`` (dedupes the undraft call) and
``review_request`` (also avoids re-pinging a human).

Imports run one way: ``base`` -> the two side effects -> ``context``. The
handed-over ``GreenCheckSuiteContext`` lives in its own module so ``base`` and
the side effects don't have to import each other.
"""

from sentry.seer.autofix.pr_iteration.green_check_suite.base import GreenCheckSuite
from sentry.seer.autofix.pr_iteration.green_check_suite.context import GreenCheckSuiteContext

__all__ = ["GreenCheckSuite", "GreenCheckSuiteContext"]
