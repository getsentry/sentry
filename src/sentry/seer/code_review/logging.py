"""
Debug logging utilities for code review webhook flows.

Enable via: options.set("seer.code-review.debug-logging", True)
"""

from __future__ import annotations

import logging

from sentry import options

logger = logging.getLogger(__name__)


def debug_log(msg: str, *, extra: dict | None = None) -> None:
    """
    Log a debug message if seer.code-review.debug-logging is enabled.
    Enable via: options.set("seer.code-review.debug-logging", True)
    """
    if options.get("seer.code-review.debug-logging", False):
        logger.info(msg, extra=extra or {})
