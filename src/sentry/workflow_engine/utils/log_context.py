"""Tools for context-aware logging in the workflow engine.

This module provides utilities to simplify context-aware logging by ensuring key data is automatically
annotated to log records and reducing the need to pass around data solely for logging purposes.

When in doubt, just log as you would normally; context data is for guaranteeing data
is present on each message, not for keeping you from ever having to set extra= when logging.
If you find yourself auditing logs to ensure a particular field is there, or adding extra parameters
to a few methods for the purposes of logging, that's when you should consider using context data.


Example usage:
    logger = log_context.get_logger(__name__)

    @log_context.root
    def defrog_worfklow(workflow_id: int) -> None:
        log_context.add_extras(workflow_id=workflow_id)
        logger.info("Starting workflow")  # Log will include workflow_id
        ...
        with log_context.new_context(rule_id=rule.id):
            logger.info("Processing rule")  # Log will include rule_id and workflow_id.
            ...

The context is automatically cleaned up when the function returns, ensuring no context leakage.
"""

import contextvars
import logging
import uuid
from collections.abc import Callable, Generator, MutableMapping
from contextlib import contextmanager
from dataclasses import dataclass, field
from functools import wraps
from typing import Any, TypeVar, override


@dataclass
class LogContextData:
    """The data consulted when modifying log records."""

    verbose: bool = False

    # TODO: Hide `extra` and have a `set_extra` method to ensure nobody is using
    # context extra data in business logic.
    extra: dict[str, Any] = field(default_factory=dict)


_log_context_state = contextvars.ContextVar[LogContextData]("log_context", default=LogContextData())


class _Adapter(logging.LoggerAdapter[logging.Logger]):
    def debug(self, msg: str, *args: Any, **kwargs: Any) -> None:  # type: ignore[override]
        if _log_context_state.get().verbose:
            self.info(msg, *args, **kwargs)
        else:
            self.log(logging.DEBUG, msg, *args, **kwargs)

    @override
    def process(
        self, msg: str, kwargs: MutableMapping[str, Any]
    ) -> tuple[str, MutableMapping[str, Any]]:
        context = _log_context_state.get()
        if context.extra:
            if "extra" in kwargs:
                kwargs["extra"] = {**context.extra, **kwargs["extra"]}
            else:
                kwargs["extra"] = context.extra
        return msg, kwargs


def get_logger(name: str) -> logging.Logger:
    """
    Returns a Logger that will be annotated based on the current context.
    """
    # We need to fake the type here because we want callers to be able to treat it as
    # a Logger, which it is for nearly any practical purpose.
    return _Adapter(logging.getLogger(name))  # type: ignore[return-value]


def set_verbose(verbose: bool) -> None:
    """
    Set the verbose flag for the current context.
    When set, DEBUG logs will be promoted to INFO level.
    """
    _log_context_state.get().verbose = verbose


def add_extras(**extras: Any) -> None:
    """
    Add extra data for the current context.
    This data will be included in all log records for the current context.
    """
    _log_context_state.get().extra.update(extras)


@contextmanager
def new_context(verbose: bool | None = None, **extras: Any) -> Generator[LogContextData]:
    """
    Create a new sub-context.
    The sub-context will be cleaned up when the context manager exits.
    """
    current = _log_context_state.get()
    new_extra = dict(current.extra)
    new_extra.update(extras)
    new_ctx = LogContextData(verbose if verbose is not None else current.verbose, new_extra)
    token = _log_context_state.set(new_ctx)
    try:
        yield new_ctx
    finally:
        _log_context_state.reset(token)


T = TypeVar("T")


def root(add_context_id: bool = True) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator defines a function as the root of a log context.
    When it executes, it will start with a fresh context, and any
    modifications to the context will be discarded when it returns.
    Additionally, it will add a unique context ID to log records, allowing you
    to easily filter logs to a specific context and exclude logs from
    other threads or processes in the same file.
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            data = LogContextData()
            if add_context_id:
                data.extra["context_id"] = str(uuid.uuid4())
            token = _log_context_state.set(data)
            try:
                return func(*args, **kwargs)
            finally:
                _log_context_state.reset(token)

        return wrapper

    return decorator
