"""
sentry.utils.csp
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import
import jsonschema

from sentry.utils.http import is_valid_origin
from sentry.schemas.security_reports import SCHEMAS

# Default block list sourced from personal experience as well as
# reputable blogs from Twitter and Dropbox
DEFAULT_DISALLOWED_SOURCES = (
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


def is_valid_csp_report(report, project=None):
    try:
        jsonschema.validate(report, SCHEMAS['csp'])
    except jsonschema.ValidationError:
        return False

    # Unfortunately the logic for disallowed sources is currently too complex
    # to be represented in a JSON schema so we still need to do this manually.
    uris = filter(bool, (report.get('blocked_uri'), report.get('source_file')))
    disallowed = ()

    if project is None or bool(project.get_option('sentry:csp_ignored_sources_defaults', True)):
        disallowed += DEFAULT_DISALLOWED_SOURCES
    if project is not None:
        disallowed += tuple(project.get_option('sentry:csp_ignored_sources', []))

    if disallowed and any(is_valid_origin(uri, allowed=disallowed) for uri in uris):
        return False

    return True
