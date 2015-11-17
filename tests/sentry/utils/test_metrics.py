from __future__ import absolute_import

import mock
import pytest

from sentry.utils.metrics import timer


def test_timer_success():
    with mock.patch('sentry.utils.metrics.timing') as timing:
        with timer('key', tags={'foo': True}) as tags:
            tags['bar'] = False

        assert timing.call_count is 1
        args, kwargs = timing.call_args
        assert args[0] is 'key'
        assert args[3] == {
            'foo': True,
            'bar': False,
            'result': 'success',
        }


class ExpectedError(Exception):
    pass


def test_timer_failure():
    with mock.patch('sentry.utils.metrics.timing') as timing:
        with pytest.raises(ExpectedError):
            with timer('key', tags={'foo': True}):
                raise ExpectedError

        assert timing.call_count is 1
        args, kwargs = timing.call_args
        assert args[0] is 'key'
        assert args[3] == {
            'foo': True,
            'result': 'failure',
        }
