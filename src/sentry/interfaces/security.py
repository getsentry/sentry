"""
sentry.interfaces.security
~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import jsonschema
import six

__all__ = ('Csp', 'ExpectCT', 'ExpectStaple')

from six.moves.urllib.parse import urlsplit, urlunsplit

from sentry.interfaces.base import Interface, InterfaceValidationError
from sentry.interfaces.schemas import validate_and_default_interface, INPUT_SCHEMAS
from sentry.utils import json
from sentry.utils.cache import memoize
from sentry.utils.http import is_valid_origin
from sentry.utils.safe import trim
from sentry.web.helpers import render_to_string

# Default block list sourced from personal experience as well as
# reputable blogs from Twitter and Dropbox
DEFAULT_DISALLOWED_SOURCES = (
    'about',  # Noise from Chrome about page.
    'ms-browser-extension',
    'chrome://*',
    'chrome-extension://*',
    'chromeinvokeimmediate://*'
    'chromenull://*',
    'safari-extension://*',
    'mxaddon-pkg://*',
    'jar://*',
    'webviewprogressproxy://*',
    'ms-browser-extension://*',
    'tmtbff://*',
    'mbinit://*',
    'symres://*',
    'resource://*',
    '*.metrext.com',
    'static.image2play.com',
    '*.tlscdn.com',
    '73a5b0806e464be8bd4e694c744624f0.com',
    '020dfefc4ac745dab7594f2f771c1ded.com',
    '*.superfish.com',
    'addons.mozilla.org',
    'v.zilionfast.in',
    'widgets.amung.us',
    '*.superfish.com',
    'xls.searchfun.in',
    'istatic.datafastguru.info',
    'v.zilionfast.in',
    'localhost',
    'resultshub-a.akamaihd.net',
    'pulseadnetwork.com',
    'gateway.zscalertwo.net',
    'www.passpack.com',
    'middlerush-a.akamaihd.net',
    'www.websmartcenter.com',
    'a.linkluster.com',
    'saveyoutime.ru',
    'cdncache-a.akamaihd.net',
    'x.rafomedia.com',
    'savingsslider-a.akamaihd.net',
    'injections.adguard.com',
    'icontent.us',
    'amiok.org',
    'connectionstrenth.com',
    'siteheart.net',
    'netanalitics.space',
)  # yapf: disable


class SecurityReport(Interface):
    """
    A browser security violation report.
    """

    path = None
    title = None

    @classmethod
    def from_raw(cls, raw):
        """
        Constructs the interface from a raw security report request body

        This is usually slightly different than to_python as it needs to
        do some extra validation, data extraction / default setting.
        """
        raise NotImplementedError

    @classmethod
    def to_python(cls, data):
        is_valid, errors = validate_and_default_interface(data, cls.path)
        if not is_valid:
            raise InterfaceValidationError("Invalid interface data")

        return cls(**data)

    def get_culprit(self):
        raise NotImplementedError

    def get_message(self):
        raise NotImplementedError

    def get_path(self):
        return self.path

    def get_tags(self):
        raise NotImplementedError

    def get_title(self):
        return self.title

    def should_filter(self, project=None):
        raise NotImplementedError

    def get_origin(self):
        """
        The document URL that generated this report
        """
        raise NotImplementedError

    def get_referrer(self):
        """
        The referrer of the page that generated this report.
        """
        raise NotImplementedError


class ExpectStaple(SecurityReport):
    """
    An OCSP Stapling violation report

    See: https://docs.google.com/document/d/1aISglJIIwglcOAhqNfK-2vtQl-_dWAapc-VLDh-9-BE
    >>> {
    >>>     "date-time": date-time,
    >>>     "hostname": hostname,
    >>>     "port": port,
    >>>     "effective-expiration-date": date-time,
    >>>     "response-status": ResponseStatus,
    >>>     "ocsp-response": ocsp,
    >>>     "cert-status": CertStatus,
    >>>     "served-certificate-chain": [pem1, ... pemN],(MUST be in the order served)
    >>>     "validated-certificate-chain": [pem1, ... pemN](MUST be in the order served)
    >>> }
    """

    score = 1300
    display_score = 1300

    path = 'expectstaple'
    title = 'Expect-Staple Report'

    @classmethod
    def from_raw(cls, raw):
        # Validate the raw data against the input schema (raises on failure)
        schema = INPUT_SCHEMAS[cls.path]
        jsonschema.validate(raw, schema)

        # For Expect-Staple, the values we want are nested under the
        # 'expect-staple-report' key.
        raw = raw['expect-staple-report']
        # Trim values and convert keys to use underscores
        kwargs = {k.replace('-', '_'): trim(v, 1024) for k, v in six.iteritems(raw)}

        return cls.to_python(kwargs)

    def get_culprit(self):
        return self.hostname

    def get_hash(self, is_processed_data=True):
        return [self.hostname]

    def get_message(self):
        return "Expect-Staple failed for '{self.hostname}'".format(self=self)

    def get_tags(self):
        return (
            ('port', six.text_type(self.port)),
            ('hostname', self.hostname),
            ('response_status', self.response_status),
            ('cert_status', self.cert_status),
        )

    def get_origin(self):
        return self.hostname

    def get_referrer(self):
        return None

    def should_filter(self, project=None):
        return False


class ExpectCT(SecurityReport):
    """
    A Certificate Transparency violation report.

    See also: http://httpwg.org/http-extensions/expect-ct.html
    >>> {
    >>>     "date-time": "2014-04-06T13:00:50Z",
    >>>     "hostname": "www.example.com",
    >>>     "port": 443,
    >>>     "effective-expiration-date": "2014-05-01T12:40:50Z",
    >>>     "served-certificate-chain": [],
    >>>     "validated-certificate-chain": [],
    >>>     "scts-pins": [],
    >>> }
    """

    score = 1300
    display_score = 1300

    path = 'expectct'
    title = 'Expect-CT Report'

    @classmethod
    def from_raw(cls, raw):
        # Validate the raw data against the input schema (raises on failure)
        schema = INPUT_SCHEMAS[cls.path]
        jsonschema.validate(raw, schema)

        # For Expect-CT, the values we want are nested under the 'expect-ct-report' key.
        raw = raw['expect-ct-report']
        # Trim values and convert keys to use underscores
        kwargs = {k.replace('-', '_'): trim(v, 1024) for k, v in six.iteritems(raw)}

        return cls.to_python(kwargs)

    def get_culprit(self):
        return self.hostname

    def get_hash(self, is_processed_data=True):
        return [self.hostname]

    def get_message(self):
        return "Expect-CT failed for '{self.hostname}'".format(self=self)

    def get_tags(self):
        return (
            ('port', six.text_type(self.port)),
            ('hostname', self.hostname),
        )

    def get_origin(self):
        return self.hostname  # not quite origin, but the domain that failed pinning

    def get_referrer(self):
        return None

    def should_filter(self, project=None):
        return False


class Csp(SecurityReport):
    """
    A CSP violation report.

    See also: http://www.w3.org/TR/CSP/#violation-reports

    >>> {
    >>>     "document_uri": "http://example.com/",
    >>>     "violated_directive": "style-src cdn.example.com",
    >>>     "blocked_uri": "http://example.com/style.css",
    >>>     "effective_directive": "style-src",
    >>> }
    """

    LOCAL = "'self'"
    score = 1300
    display_score = 1300

    path = 'sentry.interfaces.Csp'
    title = 'CSP Report'

    @classmethod
    def from_raw(cls, raw):
        # Validate the raw data against the input schema (raises on failure)
        schema = INPUT_SCHEMAS[cls.path]
        jsonschema.validate(raw, schema)

        # For CSP, the values we want are nested under the 'csp-report' key.
        raw = raw['csp-report']
        # Trim values and convert keys to use underscores
        kwargs = {k.replace('-', '_'): trim(v, 1024) for k, v in six.iteritems(raw)}

        return cls.to_python(kwargs)

    def get_hash(self, is_processed_data=True):
        if self._local_script_violation_type:
            uri = "'%s'" % self._local_script_violation_type
        else:
            uri = self._normalized_blocked_uri

        return [self.effective_directive, uri]

    def get_message(self):
        templates = {
            'child-src': (u"Blocked 'child' from '{uri}'", "Blocked inline 'child'"),
            'connect-src': (u"Blocked 'connect' from '{uri}'", "Blocked inline 'connect'"),
            'font-src': (u"Blocked 'font' from '{uri}'", "Blocked inline 'font'"),
            'form-action': (u"Blocked 'form' action to '{uri}'", ),  # no inline option
            'img-src': (u"Blocked 'image' from '{uri}'", "Blocked inline 'image'"),
            'manifest-src': (u"Blocked 'manifest' from '{uri}'", "Blocked inline 'manifest'"),
            'media-src': (u"Blocked 'media' from '{uri}'", "Blocked inline 'media'"),
            'object-src': (u"Blocked 'object' from '{uri}'", "Blocked inline 'object'"),
            'script-src': (u"Blocked 'script' from '{uri}'", "Blocked unsafe (eval() or inline) 'script'"),
            'style-src': (u"Blocked 'style' from '{uri}'", "Blocked inline 'style'"),
            'unsafe-inline': (None, u"Blocked unsafe inline 'script'"),
            'unsafe-eval': (None, u"Blocked unsafe eval() 'script'"),
        }
        default_template = ('Blocked {directive!r} from {uri!r}', 'Blocked inline {directive!r}')

        directive = self._local_script_violation_type or self.effective_directive
        uri = self._normalized_blocked_uri
        index = 1 if uri == self.LOCAL else 0

        try:
            tmpl = templates[directive][index]
        except (KeyError, IndexError):
            tmpl = default_template[index]

        return tmpl.format(directive=directive, uri=uri)

    def get_culprit(self):
        if not self.violated_directive:
            return ''
        bits = [d for d in self.violated_directive.split(' ') if d]
        return ' '.join([bits[0]] + [self._normalize_value(b) for b in bits[1:]])

    def get_tags(self):
        return [
            ('effective-directive', self.effective_directive),
            ('blocked-uri', self._sanitized_blocked_uri()),
        ]

    def get_origin(self):
        return self.document_uri

    def get_referrer(self):
        return self.referrer

    def to_string(self, is_public=False, **kwargs):
        return json.dumps({'csp-report': self.get_api_context()}, indent=2)

    def to_email_html(self, event, **kwargs):
        return render_to_string(
            'sentry/partial/interfaces/csp_email.html', {'data': self.get_api_context()}
        )

    def should_filter(self, project=None):
        disallowed = ()
        paths = ['blocked_uri', 'source_file']
        uris = [getattr(self, path) for path in paths if hasattr(self, path)]

        if project is None or bool(project.get_option('sentry:csp_ignored_sources_defaults', True)):
            disallowed += DEFAULT_DISALLOWED_SOURCES
        if project is not None:
            disallowed += tuple(project.get_option('sentry:csp_ignored_sources', []))

        if disallowed and any(is_valid_origin(uri and uri, allowed=disallowed) for uri in uris):
            return True

        return False

    def _sanitized_blocked_uri(self):
        # HACK: This is 100% to work around Stripe urls
        # that will casually put extremely sensitive information
        # in querystrings. The real solution is to apply
        # data scrubbing to all tags generically
        # TODO this could be done in filter_csp
        # instead but that might only be run conditionally on the org/project settings
        # relevant code is @L191:
        #
        #   if netloc == 'api.stripe.com':
        #       query = ''
        #       fragment = ''

        uri = self.blocked_uri
        if uri.startswith('https://api.stripe.com/'):
            return urlunsplit(urlsplit(uri)[:3] + (None, None))
        return uri

    @memoize
    def _normalized_blocked_uri(self):
        return self._normalize_uri(self.blocked_uri)

    @memoize
    def _normalized_document_uri(self):
        return self._normalize_uri(self.document_uri)

    def _normalize_value(self, value):
        keywords = ("'none'", "'self'", "'unsafe-inline'", "'unsafe-eval'", )
        all_schemes = (
            'data:',
            'mediastream:',
            'blob:',
            'filesystem:',
            'http:',
            'https:',
            'file:',
        )

        # > If no scheme is specified, the same scheme as the one used to
        # > access the protected document is assumed.
        # Source: https://developer.mozilla.org/en-US/docs/Web/Security/CSP/CSP_policy_directives
        if value in keywords:
            return value

        # normalize a value down to 'self' if it matches the origin of document-uri
        # FireFox transforms a 'self' value into the spelled out origin, so we
        # want to reverse this and bring it back
        if value.startswith(all_schemes):
            if self._normalized_document_uri == self._normalize_uri(value):
                return self.LOCAL
            # Their rule had an explicit scheme, so let's respect that
            return value

        # value doesn't have a scheme, but let's see if their
        # hostnames match at least, if so, they're the same
        if value == self._normalized_document_uri:
            return self.LOCAL

        # Now we need to stitch on a scheme to the value
        scheme = self.document_uri.split(':', 1)[0]
        # But let's not stitch on the boring values
        if scheme in ('http', 'https'):
            return value
        return self._unsplit(scheme, value)

    @memoize
    def _local_script_violation_type(self):
        """
        If this is a locally-sourced script-src error, gives the type.
        """
        if (self.violated_directive
                and self.effective_directive == 'script-src'
                and self._normalized_blocked_uri == self.LOCAL):
            if "'unsafe-inline'" in self.violated_directive:
                return "unsafe-inline"
            elif "'unsafe-eval'" in self.violated_directive:
                return "unsafe-eval"
        return None

    def _normalize_uri(self, value):
        if value in ('', self.LOCAL, self.LOCAL.strip("'")):
            return self.LOCAL

        # A lot of these values get reported as literally
        # just the scheme. So a value like 'data' or 'blob', which
        # are valid schemes, just not a uri. So we want to
        # normalize it into a uri.
        if ':' not in value:
            scheme, hostname = value, ''
        else:
            scheme, hostname = urlsplit(value)[:2]
            if scheme in ('http', 'https'):
                return hostname
        return self._unsplit(scheme, hostname)

    def _unsplit(self, scheme, hostname):
        return urlunsplit((scheme, hostname, '', None, None))
