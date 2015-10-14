"""
sentry.interfaces.csp
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Csp',)

from urlparse import urlsplit
from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.utils.safe import trim


# Sourced from https://developer.mozilla.org/en-US/docs/Web/Security/CSP/CSP_policy_directives
REPORT_KEYS = frozenset((
    'blocked_uri', 'document_uri', 'effective_directive', 'original_policy',
    'referrer', 'status_code', 'violated_directive', 'source_file',
    'line_number', 'column_number',

    # FireFox specific keys
    'script_sample',
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

    See also: http://www.w3.org/TR/CSP/#violation-reports

    >>> {
    >>>     "document_uri": "http://example.com/",
    >>>     "violated_directive": "style-src cdn.example.com",
    >>>     "blocked_uri": "http://example.com/style.css",
    >>>     "effective_uri": "style-src",
    >>> }
    """
    @classmethod
    def to_python(cls, data):
        kwargs = {k: trim(data.get(k, None), 1024) for k in REPORT_KEYS}

        if kwargs['effective_directive'] is None:
            raise InterfaceValidationError("'effective_directive' is missing")

        # Some reports from Chrome report blocked-uri as just 'about'.
        # In this case, this is not actionable and is just noisy.
        # Observed in Chrome 45 and 46.
        if kwargs['blocked_uri'] == 'about':
            raise InterfaceValidationError("blocked-uri must not be 'about'")

        # Inline script violations are confusing and don't say what uri blocked them
        # because they're inline. FireFox sends along "blocked-uri": "self", which is
        # vastly more useful, so we want to emulate that
        if kwargs['effective_directive'] == 'script-src' and not kwargs['blocked_uri']:
            kwargs['blocked_uri'] = 'self'

        return cls(**kwargs)

    def get_hash(self):
        # The hash of a CSP report is it's normalized `violated-directive`.
        # This normalization has to be done for FireFox because they send
        # weird stuff compared to Safari and Chrome.
        # NOTE: this may or may not be great, not sure until we see it in the wild
        return [':'.join(self.get_violated_directive()), ':'.join(self.get_culprit_directive())]

    def get_violated_directive(self):
        return 'violated-directive', self._normalize_directive(self.violated_directive)

    def get_culprit_directive(self):
        if self.blocked_uri:
            return 'blocked-uri', self.blocked_uri
        return 'effective-directive', self._normalize_directive(self.effective_directive)

    def get_path(self):
        return 'sentry.interfaces.Csp'

    def get_message(self):
        return 'CSP Violation: %s %r' % self.get_culprit_directive()

    def get_culprit(self):
        return '%s in %r' % self.get_violated_directive()

    def _normalize_directive(self, directive):
        if directive is None:
            return '<unknown>'
        bits = filter(None, directive.split(' '))
        return ' '.join([bits[0]] + map(self._normalize_value, bits[1:]))

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

        # Now we need to stitch on a scheme to the value
        scheme = self.document_uri.split(':', 1)[0]
        # These schemes need to have an additional '//' to be a url
        if scheme in ('http', 'https', 'file'):
            return '%s://%s' % (scheme, value)
        # The others do not
        return '%s:%s' % (scheme, value)


def _get_origin(value):
    "Extract the origin out of a url, which is just scheme+host"
    scheme, hostname = urlsplit(value)[:2]
    if scheme in ('http', 'https', 'file'):
        return '%s://%s' % (scheme, hostname)
    return '%s:%s' % (scheme, hostname)
