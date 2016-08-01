from __future__ import absolute_import

import pytest

from sentry.utils.csp import is_valid_csp_report


@pytest.mark.parametrize('report', (
    {},
    {'effective-directive': 'lolnotreal'},
    {'effective-directive': 'style-src'},
    {'effective-directive': 'style-src', 'blocked-uri': 'about'},
    {'effective-directive': 'style-src', 'source-file': 'chrome-extension://fdsa'},
    {'effective-directive': 'style-src', 'source-file': 'http://localhost:8000'},
    {'effective-directive': 'style-src', 'source-file': 'http://localhost'},
    {'effective-directive': 'style-src', 'source-file': 'http://foo.superfish.com'},
    {'effective-directive': 'style-src', 'blocked-uri': 'http://foo.superfish.com'},
))
def test_blocked_csp_report(report):
    assert is_valid_csp_report(report) is False


@pytest.mark.parametrize('report', (
    {'effective-directive': 'style-src', 'blocked-uri': 'http://example.com'},
    {'effective-directive': 'script-src', 'blocked-uri': 'http://example.com'},
    {'effective-directive': 'style-src', 'source-file': 'http://example.com'},
))
def test_valid_csp_report(report):
    assert is_valid_csp_report(report) is True
