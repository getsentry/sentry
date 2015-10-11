"""
sentry.interfaces.csp
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Csp',)

from urlparse import urlsplit
from sentry.interfaces.base import Interface
from sentry.utils.safe import trim

REPORT_KEYS = frozenset((
    'blocked_uri', 'document_uri', 'effective_directive', 'original_policy',
    'referrer', 'status_code', 'violated_directive', 'source_file',
    'line_number', 'column_number',
))

KEYWORDS = frozenset((
    "'none'", "'self'", "'unsafe-inline'", "'unsafe-eval'",
))

ALL_SCHEMES = (
    'data:', 'mediastream:', 'blob:', 'filesystem:',
    'http:', 'https:', 'file:',
)


class Csp(Interface):
    """
    A CSP violation report.

    >>> {
    >>>     "document_uri": "http://example.com/",
    >>>     "violated_directive": "style-src cdn.example.com",
    >>>     "blocked_uri": "http://example.com/style.css",
    >>> }
    """
    @classmethod
    def to_python(cls, data):
        kwargs = {k: trim(data.get(k, None), 1024) for k in REPORT_KEYS}
        return cls(**kwargs)

    def get_hash(self):
        # this may or may not be great, not sure until we see it in the wild
        bits = filter(None, self.violated_directive.split(' '))
        return [bits[0]] + map(self._normalize_value, bits[1:])

    def get_path(self):
        return 'sentry.interfaces.Csp'

    def get_message(self):
        return 'CSP Violation: %r' % ' '.join(self.get_hash())

    def get_culprit(self):
        return self.blocked_uri or self.effective_directive or self.violated_directive

    def _normalize_value(self, value):
        # > If no scheme is specified, the same scheme as the one used to
        # > access the protected document is assumed.
        # Source: https://developer.mozilla.org/en-US/docs/Web/Security/CSP/CSP_policy_directives
        if value in KEYWORDS:
            return value

        # normalize a value down to 'self' if it matches the origin of document-uri
        # FireFox transforms a 'self' value into the spelled out origin, so we
        # want to reverse this and bring it back
        if value.startswith(ALL_SCHEMES):
            if _get_origin(self.document_uri) == value:
                return "'self'"
            return value
        scheme = self.document_uri.split(':', 1)[0]
        # These schemes need to have an additional '//' to be a url
        if scheme in ('http', 'https', 'file'):
            return '%s://%s' % (scheme, value)
        # The others do not
        return '%s:%s' % (scheme, value)


def _get_origin(value):
    scheme, hostname = urlsplit(value)[:2]
    if scheme in ('http', 'https', 'file'):
        return '%s://%s' % (scheme, hostname)
    return '%s:%s' % (scheme, hostname)
