from __future__ import absolute_import

import pytest

from sentry.models import EventError


@pytest.mark.parametrize('data,message', (
    ({'type': 'unknown_error'}, u'Unknown error'),
    ({'type': 'unknown_error', 'foo': 'bar'}, u'Unknown error'),
    ({'type': 'invalid_data', 'name': 'foo'}, u"Discarded invalid value for parameter 'foo'"),
    ({'type': 'invalid_data'}, u"Discarded invalid value for parameter ''"),
))
def test_get_message(data, message):
    assert EventError.get_message(data) == message
