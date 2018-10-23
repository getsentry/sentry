# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import mock

from sentry.event_manager import get_hashes_for_event
from sentry.models import Event


@mock.patch('sentry.interfaces.stacktrace.Stacktrace.compute_hashes')
@mock.patch('sentry.interfaces.http.Http.compute_hashes')
def test_stacktrace_wins_over_http(http_comp_hash, stack_comp_hash):
    # this was a regression, and a very important one
    http_comp_hash.return_value = [['baz']]
    stack_comp_hash.return_value = [['foo', 'bar']]
    event = Event(
        data={
            'sentry.interfaces.Stacktrace': {
                'frames': [{
                    'lineno': 1,
                    'filename': 'foo.py',
                }],
            },
            'sentry.interfaces.Http': {
                'url': 'http://example.com'
            },
        },
        platform='python',
        message='Foo bar',
    )
    hashes = get_hashes_for_event(event)
    assert len(hashes) == 1
    hash_one = hashes[0]
    stack_comp_hash.assert_called_once_with('python')
    assert not http_comp_hash.called
    assert hash_one == ['foo', 'bar']
