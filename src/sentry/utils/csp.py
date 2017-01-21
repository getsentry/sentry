"""
sentry.utils.csp
~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from sentry.utils.http import is_valid_origin

# Default block list sourced from personal experience as well as
# reputable blogs from Twitter and Dropbox
DISALLOWED_SOURCES = (
    'chrome://*',
    'chrome-extension://*',
    'chromeinvokeimmediate://*'
    'chromenull://*',
    'safari-extension://*',
    'mxaddon-pkg://*',
    'jar://*',
    'webviewprogressproxy://*',
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
)

ALLOWED_DIRECTIVES = frozenset((
    'base-uri', 'child-src', 'connect-src', 'default-src',
    'font-src', 'form-action', 'frame-ancestors',
    'img-src', 'manifest-src', 'media-src', 'object-src',
    'plugin-types', 'referrer', 'script-src', 'style-src',
    'upgrade-insecure-requests',

    # Deprecated directives
    # > Note: This directive is deprecated. Use child-src instead.
    # > https://developer.mozilla.org/en-US/docs/Web/Security/CSP/CSP_policy_directives#frame-src
    # 'frame-src',

    # I don't really know what this even is.
    # 'sandbox',
))


def is_valid_csp_report(report, project=None):
    # Some reports from Chrome report blocked-uri as just 'about'.
    # In this case, this is not actionable and is just noisy.
    # Observed in Chrome 45 and 46.
    if report.get('effective_directive') not in ALLOWED_DIRECTIVES:
        return False

    blocked_uri = report.get('blocked_uri')
    if blocked_uri == 'about':
        return False

    source_file = report.get('source_file')

    # We must have one of these to do anyting sensible
    if not any((blocked_uri, source_file)):
        return False

    if project is None or bool(project.get_option('sentry:csp_ignore_hosts_defaults', True)):
        disallowed_sources = DISALLOWED_SOURCES
    else:
        disallowed_sources = ()

    if project is not None:
        disallowed_sources += tuple(project.get_option('sentry:csp_ignore_hosts', []))

    if not disallowed_sources:
        return True

    if source_file and is_valid_origin(source_file, allowed=disallowed_sources):
        return False

    if blocked_uri and is_valid_origin(blocked_uri, allowed=disallowed_sources):
        return False

    return True
