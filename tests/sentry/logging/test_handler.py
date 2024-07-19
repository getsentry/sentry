import logging
from typing import Any
from unittest import mock

import pytest

from sentry.logging.handlers import JSONRenderer, StructLogHandler


@pytest.fixture
def handler():
    return StructLogHandler()


@pytest.fixture
def logger():
    return mock.MagicMock()


@pytest.fixture
def snafu() -> Any:
    class SNAFU:
        def __str__(self) -> str:
            raise Exception("snafu")

    return SNAFU()


def make_logrecord(
    *,
    name: str = "name",
    level: int = logging.INFO,
    pathname: str = "pathname",
    lineno: int = 10,
    msg: str = "msg",
    args: Any = None,
    exc_info: Any = None,
    **extra: Any,
) -> logging.LogRecord:
    return logging.LogRecord(
        name=name,
        level=level,
        pathname=pathname,
        lineno=lineno,
        msg=msg,
        args=args,
        exc_info=exc_info,
        **extra,
    )


@pytest.mark.parametrize(
    "record,out",
    (
        ({}, {}),
        ({"msg": "%s", "args": (1,)}, {"event": "%s", "positional_args": (1,)}),
        ({"args": ({"a": 1},)}, {"positional_args": ({"a": 1},)}),
        ({"exc_info": True}, {"exc_info": True}),
    ),
)
def test_emit(record, out, handler, logger):
    record = make_logrecord(**record)
    handler.emit(record, logger=logger)
    expected = dict(level=logging.INFO, event="msg", name="name")
    expected.update(out)
    logger.log.assert_called_once_with(**expected)


@mock.patch("sentry.logging.handlers.metrics")
def test_log_to_metric(metrics):
    logger = logging.getLogger("django.request")
    logger.warning("CSRF problem")
    metrics.incr.assert_called_once_with("django.request.csrf_problem", skip_internal=False)

    metrics.reset_mock()

    logger.warning("Some other problem we don't care about")
    assert metrics.incr.call_count == 0


@mock.patch("logging.raiseExceptions", True)
def test_emit_invalid_keys_nonprod(handler):
    logger = mock.MagicMock()
    logger.log.side_effect = TypeError("invalid keys")
    with pytest.raises(TypeError):
        handler.emit(make_logrecord(), logger=logger)


@mock.patch("logging.raiseExceptions", False)
def test_emit_invalid_keys_prod(handler):
    logger = mock.MagicMock()
    logger.log.side_effect = TypeError("invalid keys")
    handler.emit(make_logrecord(), logger=logger)


@mock.patch("logging.raiseExceptions", True)
def test_JSONRenderer_nonprod():
    renderer = JSONRenderer()
    with pytest.raises(TypeError):
        renderer(None, None, {"foo": {mock.Mock(): "foo"}})


@mock.patch("logging.raiseExceptions", False)
def test_JSONRenderer_prod():
    renderer = JSONRenderer()
    renderer(None, None, {"foo": {mock.Mock(): "foo"}})


@mock.patch("logging.raiseExceptions", True)
def test_logging_raiseExcpetions_enabled_generic_logging(caplog, snafu):
    logger = logging.getLogger(__name__)

    with pytest.raises(Exception) as exc_info:
        logger.log(logging.INFO, snafu)
    assert exc_info.value.args == ("snafu",)


@mock.patch("logging.raiseExceptions", False)
def test_logging_raiseExcpetions_disabled_generic_logging(caplog, snafu):
    logger = logging.getLogger(__name__)
    logger.log(logging.INFO, snafu)
