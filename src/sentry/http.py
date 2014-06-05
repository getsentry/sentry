"""
sentry.utils.http
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

import sentry
import socket
import urllib2

from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from ipaddr import IPNetwork
from urlparse import urlparse


DISALLOWED_IPS = map(IPNetwork, settings.SENTRY_DISALLOWED_IPS)


class NoRedirectionHandler(urllib2.HTTPErrorProcessor):
    def http_response(self, request, response):
        return response

    https_response = http_response


def is_valid_url(url):
    """
    Tests a URL to ensure it doesn't appear to be a blacklisted IP range.
    """
    parsed = urlparse(url)
    ip_network = IPNetwork(socket.gethostbyname(parsed.hostname))
    for addr in DISALLOWED_IPS:
        if ip_network in addr:
            return False
    return True


def safe_urlopen(url, data=None, headers=(), user_agent='sentry/%s' % sentry.VERSION,
                 allow_redirects=False, timeout=30):
    """
    A slightly safer version of ``urlib2.urlopen`` which prevents redirection
    and ensures the URL isn't attempting to hit a blacklisted IP range.
    """
    if not is_valid_url(url):
        raise SuspiciousOperation('%s matches the URL blacklist' % (url,))

    req = urllib2.Request(url, data)
    req.add_header('User-Agent', user_agent)
    for key, value in headers:
        req.add_header(key, value)

    handlers = []
    if not allow_redirects:
        handlers.append(NoRedirectionHandler)

    opener = urllib2.build_opener(*handlers)

    return opener.open(req, timeout=timeout)
