"""
sentry.utils.http
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import re
import sentry
import socket
import requests

from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from ipaddr import IPNetwork
from urlparse import urlparse

CHARSET_RE = re.compile(r'charset=(\S+)')

DEFAULT_ENCODING = 'utf-8'

DEFAULT_HEADERS = ()

DEFAULT_USER_AGENT = 'sentry/%s' % sentry.VERSION

DISALLOWED_IPS = set((IPNetwork(i) for i in settings.SENTRY_DISALLOWED_IPS))


def is_valid_url(url):
    """
    Tests a URL to ensure it doesn't appear to be a blacklisted IP range.
    """
    parsed = urlparse(url)
    if not parsed.hostname:
        return False

    try:
        ip_address = socket.gethostbyname(parsed.hostname)
    except socket.gaierror:
        return False

    ip_network = IPNetwork(ip_address)
    for addr in DISALLOWED_IPS:
        if ip_network in addr:
            return False

    return True


def safe_urlopen(url, data=None, headers=DEFAULT_HEADERS,
                 user_agent=DEFAULT_USER_AGENT, allow_redirects=False,
                 timeout=30):
    """
    A slightly safer version of ``urlib2.urlopen`` which prevents redirection
    and ensures the URL isn't attempting to hit a blacklisted IP range.
    """
    if not is_valid_url(url):
        raise SuspiciousOperation('%s matches the URL blacklist' % (url,))

    all_headers = {header[0]: header[1] for header in headers}
    all_headers.update({'User-Agent': user_agent})

    return requests.get(url, headers=all_headers, data=data, stream=True,
                        allow_redirects=allow_redirects, timeout=timeout)


def safe_urlread(request):
    body = request.raw.read()

    content_type = request.headers.get('content-type')
    if content_type is None:
        # If there is no content_type header at all, quickly assume default utf-8 encoding
        encoding = DEFAULT_ENCODING
    else:
        try:
            encoding = CHARSET_RE.search(content_type).group(1)
        except AttributeError:
            encoding = DEFAULT_ENCODING

    return body.decode(encoding).rstrip('\n')
