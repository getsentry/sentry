from __future__ import absolute_import

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


@pytest.mark.parametrize('record,out', (
    ({}, {}),
    ({'msg': '%s', 'args': (1,)}, {'event': '%s', 'positional_args': (1,)}),
    ({'args': ({'a': 1},)}, {'positional_args': ({'a': 1},)}),
    ({'exc_info': True}, {'exc_info': True}),
))
def test_emit(record, out, handler, logger):
    record = make_logrecord(**record)
    handler.emit(record, logger=logger)
    expected = dict(level=logging.INFO, event='msg', name='name')
    expected.update(out)
    logger.log.assert_called_once_with(**expected)
