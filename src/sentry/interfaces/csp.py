"""
sentry.interfaces.csp
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

__all__ = ('Csp',)

from urlparse import urlsplit, urlunsplit
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

DIRECTIVES = frozenset((
    'base-uri', 'child-src', 'connect-src', 'default-src',
    'font-src', 'form-action', 'frame-ancestors',
    'img-src', 'manifest-src', 'media-src', 'object-src',
    'plugin-types', 'referrer', 'reflected-xss',
    'script-src', 'style-src', 'upgrade-insecure-requests',

    # Deprecated directives
    # > Note: This directive is deprecated. Use child-src instead.
    # > https://developer.mozilla.org/en-US/docs/Web/Security/CSP/CSP_policy_directives#frame-src
    # 'frame-src',

    # I don't really know what this even is.
    # 'sandbox',
))

ALL_SCHEMES = (
    'data:', 'mediastream:', 'blob:', 'filesystem:',
    'http:', 'https:', 'file:',
)

SELF = "'self'"

DIRECTIVE_TO_MESSAGES = {
    # 'base-uri': '',
    'child-src': ("Blocked 'child' from {uri!r}", "Blocked inline 'child'"),
    'connect-src': ("Blocked 'connect' from {uri!r}", "Blocked inline 'connect'"),
    # 'default-src': '',
    'font-src': ("Blocked 'font' from {uri!r}", "Blocked inline 'font'"),
    'form-action': ("Blocked 'form' action to {uri!r}",),  # no inline option
    # 'frame-ancestors': '',
    'img-src': ("Blocked 'image' from {uri!r}", "Blocked inline 'image'"),
    'manifest-src': ("Blocked 'manifest' from {uri!r}", "Blocked inline 'manifest'"),
    'media-src': ("Blocked 'media' from {uri!r}", "Blocked inline 'media'"),
    'object-src': ("Blocked 'object' from {uri!r}", "Blocked inline 'object'"),
    # 'plugin-types': '',
    # 'referrer': '',
    # 'reflected-xss': '',
    'script-src': ("Blocked 'script' from {uri!r}", "Blocked unsafe 'script'"),
    'style-src': ("Blocked 'style' from {uri!r}", "Blocked inline 'style'"),
    # 'upgrade-insecure-requests': '',
}

DEFAULT_MESSAGE = ('blocked {directive!r} from {uri!r}', 'blocked inline {directive!r}')


class Csp(Interface):
    """
    A CSP violation report.

    See also: http://www.w3.org/TR/CSP/#violation-reports

    >>> {
    >>>     "document_uri": "http://example.com/",
    >>>     "violated_directive": "style-src cdn.example.com",
    >>>     "Blocked_uri": "http://example.com/style.css",
    >>>     "effective_directive": "style-src",
    >>> }
    """
    @classmethod
    def to_python(cls, data):
        kwargs = {k: trim(data.get(k, None), 1024) for k in REPORT_KEYS}

        if kwargs['effective_directive'] not in DIRECTIVES:
            raise InterfaceValidationError("Invalid value for 'effective-directive'")

        # Some reports from Chrome report blocked-uri as just 'about'.
        # In this case, this is not actionable and is just noisy.
        # Observed in Chrome 45 and 46.
        if kwargs['blocked_uri'] == 'about':
            raise InterfaceValidationError("Invalid value for 'blocked-uri'")

        # Anything resulting from an "inline" whatever violation is either sent
        # as 'self', or left off. In the case if it missing, we want to noramalize.
        if not kwargs['blocked_uri']:
            kwargs['blocked_uri'] = 'self'

        return cls(**kwargs)

    def get_hash(self):
        directive = self.effective_directive
        uri = _normalize_uri(self.blocked_uri)

        # We want to distinguish between the different script-src
        # violations that happen in
        if _is_unsafe_script(directive, uri) and self.violated_directive:
            if "'unsafe-inline" in self.violated_directive:
                uri = "'unsafe-eval'"
            elif "'unsafe-eval'" in self.violated_directive:
                uri = "'unsafe-inline"

        return [directive, uri]

    def get_message(self):
        directive = self.effective_directive
        uri = _normalize_uri(self.blocked_uri)

        index = 1 if uri == SELF else 0

        tmpl = None

        # We want to special case script-src because they have
        # unsafe-inline and unsafe-eval, but the report is ambiguous.
        # so we want to attempt to guess which it was
        if _is_unsafe_script(directive, uri) and self.violated_directive:
            if "'unsafe-inline'" in self.violated_directive:
                tmpl = "Blocked unsafe eval() 'script'"
            elif "'unsafe-eval'" in self.violated_directive:
                tmpl = "Blocked unsafe inline 'script'"

        if tmpl is None:
            try:
                tmpl = DIRECTIVE_TO_MESSAGES[directive][index]
            except (KeyError, IndexError):
                tmpl = DEFAULT_MESSAGE[index]

        return tmpl.format(directive=directive, uri=uri)

    def get_culprit(self):
        return self._normalize_directive(self.violated_directive)

    def _normalize_directive(self, directive):
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
            if _normalize_uri(self.document_uri) == _normalize_uri(value):
                return SELF
            # Their rule had an explicit scheme, so let's respect that
            return value

        # value doesn't have a scheme, but let's see if their
        # hostnames match at least, if so, they're the same
        if value == _normalize_uri(self.document_uri):
            return SELF

        # Now we need to stitch on a scheme to the value
        scheme = self.document_uri.split(':', 1)[0]
        # But let's not stitch on the boring values
        if scheme in ('http', 'https'):
            return value
        return _unsplit(scheme, value)

    def get_path(self):
        return 'sentry.interfaces.Csp'


def _is_unsafe_script(directive, uri):
    return directive == 'script-src' and uri == SELF


def _normalize_uri(value):
    if value in ('self', "'self'"):
        return SELF

    scheme, hostname = urlsplit(value)[:2]
    if scheme in ('http', 'https'):
        return hostname
    return _unsplit(scheme, hostname)


def _unsplit(scheme, rest):
    return urlunsplit((scheme, rest, '', None, None))
