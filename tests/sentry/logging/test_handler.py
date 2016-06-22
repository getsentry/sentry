import pytest
import logging
import mock

from sentry.logging.handlers import StructLogHandler


@pytest.fixture
def handler():
    return StructLogHandler()


@pytest.fixture
def logger():
    return mock.MagicMock()


def make_logrecord(**extra):
    kwargs = dict(
        name='name',
        level=logging.INFO,
        pathname='pathname',
        lineno=10,
        msg='msg',
        args=None,
        exc_info=None,
    )
    kwargs.update(extra or {})
    return logging.LogRecord(**kwargs)


def test_emit_basic(handler, logger):
    record = make_logrecord()
    handler.emit(record, logger=logger)
    logger.info.assert_called_once_with('msg', name='name')


def test_emit_with_args(handler, logger):
    record = make_logrecord(
        msg='%s',
        args=(1,),
    )
    handler.emit(record, logger=logger)
    logger.info.assert_called_once_with('%s', name='name', positional_args=(1,))


def test_emit_with_dict_arg(handler, logger):
    record = make_logrecord(
        msg='%s',
        args=({'a': 1},),
    )
    handler.emit(record, logger=logger)
    logger.info.assert_called_once_with('%s', name='name', positional_args=({'a': 1},))


def test_emit_with_exc_info(handler, logger):
    record = make_logrecord(exc_info={'a': 1})
    handler.emit(record, logger=logger)
    logger.info.assert_called_once_with('msg', name='name', exc_info={'a': 1})
