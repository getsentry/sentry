from django.utils.functional import cached_property

from sentry.interfaces.base import Interface
from sentry.security import csp
from sentry.utils import json
from sentry.web.helpers import render_to_string

__all__ = ("Csp", "Hpkp", "ExpectCT", "ExpectStaple")


# Default block list sourced from personal experience as well as
# reputable blogs from Twitter and Dropbox
DEFAULT_DISALLOWED_SOURCES = (
    "about",  # Noise from Chrome about page.
    "ms-browser-extension",
    "chrome://*",
    "chrome-extension://*",
    "chromeinvokeimmediate://*",
    "chromenull://*",
    "data:text/html,chromewebdata",
    "safari-extension://*",
    "mxaddon-pkg://*",
    "jar://*",
    "webviewprogressproxy://*",
    "ms-browser-extension://*",
    "tmtbff://*",
    "mbinit://*",
    "symres://*",
    "resource://*",
    "moz-extension://*",
    "*.metrext.com",
    "static.image2play.com",
    "*.tlscdn.com",
    "73a5b0806e464be8bd4e694c744624f0.com",
    "020dfefc4ac745dab7594f2f771c1ded.com",
    "*.superfish.com",
    "addons.mozilla.org",
    "v.zilionfast.in",
    "widgets.amung.us",
    "*.superfish.com",
    "xls.searchfun.in",
    "istatic.datafastguru.info",
    "v.zilionfast.in",
    "localhost",
    "resultshub-a.akamaihd.net",
    "pulseadnetwork.com",
    "gateway.zscalertwo.net",
    "www.passpack.com",
    "middlerush-a.akamaihd.net",
    "www.websmartcenter.com",
    "a.linkluster.com",
    "saveyoutime.ru",
    "cdncache-a.akamaihd.net",
    "x.rafomedia.com",
    "savingsslider-a.akamaihd.net",
    "injections.adguard.com",
    "icontent.us",
    "amiok.org",
    "connectionstrenth.com",
    "siteheart.net",
    "netanalitics.space",
    "printapplink.com",
    "godlinkapp.com",
    "devappstor.com",
    "hoholikik.club",
    "smartlink.cool",
    "promfflinkdev.com",
)


class SecurityReport(Interface):
    """
    A browser security violation report.
    """

    title: str


class Hpkp(SecurityReport):
    """
    A HTTP Public Key Pinning pin validation failure report.

    See also: https://tools.ietf.org/html/rfc7469#section-3
    >>> {
    >>>     "date-time": "2014-04-06T13:00:50Z",
    >>>     "hostname": "www.example.com",
    >>>     "port": 443,
    >>>     "effective-expiration-date": "2014-05-01T12:40:50Z",
    >>>     "include-subdomains": False,
    >>>     "served-certificate-chain": [],
    >>>     "validated-certificate-chain": [],
    >>>     "known-pins": [],
    >>> }
    """

    score = 1300
    display_score = 1300

    title = "HPKP Report"


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

    title = "Expect-Staple Report"


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

    title = "Expect-CT Report"


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

    score = 1300
    display_score = 1300

    title = "CSP Report"

    @classmethod
    def to_python(cls, data, **kwargs):
        data.setdefault("document_uri", None)
        data.setdefault("violated_directive", None)
        data.setdefault("blocked_uri", None)
        data.setdefault("effective_directive", None)
        return super().to_python(data, **kwargs)

    def to_string(self, is_public=False, **kwargs):
        return json.dumps({"csp-report": self.get_api_context()})

    def to_email_html(self, event, **kwargs):
        return render_to_string(
            "sentry/partial/interfaces/csp_email.html", {"data": self.get_api_context()}
        )

    @cached_property
    def normalized_blocked_uri(self):
        return csp.normalize_value(self.blocked_uri)

    @cached_property
    def local_script_violation_type(self):
        """
        If this is a locally-sourced script-src error, gives the type.
        """
        if (
            self.violated_directive
            and self.effective_directive == "script-src"
            and self.normalized_blocked_uri == csp.LOCAL
        ):
            if "'unsafe-inline'" in self.violated_directive:
                return "unsafe-inline"
            elif "'unsafe-eval'" in self.violated_directive:
                return "unsafe-eval"
        return None
