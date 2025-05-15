import enum

from sentry_sdk_alpha.integrations import Integration, DidNotEnable
from sentry_sdk_alpha.integrations.logging import (
    BreadcrumbHandler,
    EventHandler,
    _BaseHandler,
)

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from logging import LogRecord
    from typing import Optional, Tuple, Any

try:
    import loguru
    from loguru import logger
    from loguru._defaults import LOGURU_FORMAT as DEFAULT_FORMAT
except ImportError:
    raise DidNotEnable("LOGURU is not installed")


class LoggingLevels(enum.IntEnum):
    TRACE = 5
    DEBUG = 10
    INFO = 20
    SUCCESS = 25
    WARNING = 30
    ERROR = 40
    CRITICAL = 50


SENTRY_LEVEL_FROM_LOGURU_LEVEL = {
    "TRACE": "DEBUG",
    "DEBUG": "DEBUG",
    "INFO": "INFO",
    "SUCCESS": "INFO",
    "WARNING": "WARNING",
    "ERROR": "ERROR",
    "CRITICAL": "CRITICAL",
}

DEFAULT_LEVEL = LoggingLevels.INFO.value
DEFAULT_EVENT_LEVEL = LoggingLevels.ERROR.value
# We need to save the handlers to be able to remove them later
# in tests (they call `LoguruIntegration.__init__` multiple times,
# and we can't use `setup_once` because it's called before
# than we get configuration).
_ADDED_HANDLERS = (None, None)  # type: Tuple[Optional[int], Optional[int]]


class LoguruIntegration(Integration):
    identifier = "loguru"

    def __init__(
        self,
        level=DEFAULT_LEVEL,
        event_level=DEFAULT_EVENT_LEVEL,
        breadcrumb_format=DEFAULT_FORMAT,
        event_format=DEFAULT_FORMAT,
    ):
        # type: (Optional[int], Optional[int], str | loguru.FormatFunction, str | loguru.FormatFunction) -> None
        global _ADDED_HANDLERS
        breadcrumb_handler, event_handler = _ADDED_HANDLERS

        if breadcrumb_handler is not None:
            logger.remove(breadcrumb_handler)
            breadcrumb_handler = None
        if event_handler is not None:
            logger.remove(event_handler)
            event_handler = None

        if level is not None:
            breadcrumb_handler = logger.add(
                LoguruBreadcrumbHandler(level=level),
                level=level,
                format=breadcrumb_format,
            )

        if event_level is not None:
            event_handler = logger.add(
                LoguruEventHandler(level=event_level),
                level=event_level,
                format=event_format,
            )

        _ADDED_HANDLERS = (breadcrumb_handler, event_handler)

    @staticmethod
    def setup_once():
        # type: () -> None
        pass  # we do everything in __init__


class _LoguruBaseHandler(_BaseHandler):
    def _logging_to_event_level(self, record):
        # type: (LogRecord) -> str
        try:
            return SENTRY_LEVEL_FROM_LOGURU_LEVEL[
                LoggingLevels(record.levelno).name
            ].lower()
        except (ValueError, KeyError):
            return record.levelname.lower() if record.levelname else ""


class LoguruEventHandler(_LoguruBaseHandler, EventHandler):
    """Modified version of :class:`sentry_sdk.integrations.logging.EventHandler` to use loguru's level names."""

    def __init__(self, *args, **kwargs):
        # type: (*Any, **Any) -> None
        if kwargs.get("level"):
            kwargs["level"] = SENTRY_LEVEL_FROM_LOGURU_LEVEL.get(
                kwargs.get("level", ""), DEFAULT_LEVEL
            )

        super().__init__(*args, **kwargs)


class LoguruBreadcrumbHandler(_LoguruBaseHandler, BreadcrumbHandler):
    """Modified version of :class:`sentry_sdk.integrations.logging.BreadcrumbHandler` to use loguru's level names."""

    def __init__(self, *args, **kwargs):
        # type: (*Any, **Any) -> None
        if kwargs.get("level"):
            kwargs["level"] = SENTRY_LEVEL_FROM_LOGURU_LEVEL.get(
                kwargs.get("level", ""), DEFAULT_LEVEL
            )

        super().__init__(*args, **kwargs)
