import sys
import logging

from sentry_sdk_alpha import get_client
from sentry_sdk_alpha.client import _client_init_debug
from sentry_sdk_alpha.utils import logger
from logging import LogRecord


class _DebugFilter(logging.Filter):
    def filter(self, record):
        # type: (LogRecord) -> bool
        if _client_init_debug.get(False):
            return True

        return get_client().options["debug"]


def init_debug_support():
    # type: () -> None
    if not logger.handlers:
        configure_logger()


def configure_logger():
    # type: () -> None
    _handler = logging.StreamHandler(sys.stderr)
    _handler.setFormatter(logging.Formatter(" [sentry] %(levelname)s: %(message)s"))
    logger.addHandler(_handler)
    logger.setLevel(logging.DEBUG)
    logger.addFilter(_DebugFilter())
