from __future__ import annotations

import logging
from typing import Any

from sentry.taskworker.namespaces import internal_tasks

logger = logging.getLogger(__name__)


@internal_tasks.register(name="canary_task")
def canary_task(*args: Any, **kwargs: Any) -> None:
    """No-op task used to validate a taskbroker pool's push path during migration.

    ``taskbroker-send-tasks`` seeds the shared canary topic with these; a pool being
    validated consumes and completes them, exercising consumer -> push -> worker ->
    result before the pool takes real traffic.
    """
    logger.debug("canary_task complete")
