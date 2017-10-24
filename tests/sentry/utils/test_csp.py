from __future__ import absolute_import

import pytest

from sentry.interfaces.security import Csp


@pytest.mark.parametrize(
    'report', (
        {}, {
            'effective_directive': 'lolnotreal'
        }, {
            'effective_directive': 'style-src',
            'blocked_uri': 'about'
        }, {
            'effective_directive': 'style-src',
            'blocked_uri': 'ms-browser-extension'
        }, {
            'effective_directive': 'style-src',
            'source_file': 'chrome-extension://fdsa'
        }, {
            'effective_directive': 'style-src',
            'source_file': 'http://localhost:8000'
        }, {
            'effective_directive': 'style-src',
            'source_file': 'http://localhost'
        }, {
            'effective_directive': 'style-src',
            'source_file': 'http://foo.superfish.com'
        }, {
            'effective_directive': 'style-src',
            'blocked_uri': 'http://foo.superfish.com'
        },
    )
)
def test_blocked_csp_report(report):
    assert Csp.to_python(report).should_filter() is True


@pytest.mark.parametrize(
    'report', (
        {
            'effective_directive': 'style-src',
            'blocked_uri': 'http://example.com'
        }, {
            'effective_directive': 'script-src',
            'blocked_uri': 'http://example.com'
        }, {
            'effective_directive': 'style-src',
            'source_file': 'http://example.com'
        }, {
            'effective_directive': 'style-src'
        },
    )
)
def test_valid_csp_report(report):
    assert Csp.to_python(report).should_filter() is False
