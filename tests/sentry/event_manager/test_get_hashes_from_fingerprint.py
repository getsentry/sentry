# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import mock

from sentry.models import Event
from sentry.event_hashing import md5_from_hash


@mock.patch('sentry.interfaces.stacktrace.Stacktrace.compute_hashes')
@mock.patch('sentry.interfaces.http.Http.compute_hashes')
def test_stacktrace_wins_over_http(http_comp_hash, stack_comp_hash):
    # this was a regression, and a very important one
    http_comp_hash.return_value = [['baz']]
    stack_comp_hash.return_value = [['foo', 'bar']]
    event = Event(
        data={
            'stacktrace': {
                'frames': [{
                    'lineno': 1,
                    'filename': 'foo.py',
                }],
            },
            'request': {
                'url': 'http://example.com'
            },
        },
        platform='python',
        message='Foo bar',
    )
    hashes = event.get_hashes()
    assert len(hashes) == 1
    hash_one = hashes[0]
    stack_comp_hash.assert_called_once_with('python')
    assert not http_comp_hash.called
    assert hash_one == md5_from_hash(['foo', 'bar'])
