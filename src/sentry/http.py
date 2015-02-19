"""
sentry.utils.http
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import sentry
import socket
import requests

from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from ipaddr import IPNetwork
from requests.adapters import HTTPAdapter
from urlparse import urlparse

USER_AGENT = 'sentry/%s' % sentry.VERSION

DISALLOWED_IPS = set((IPNetwork(i) for i in settings.SENTRY_DISALLOWED_IPS))


class BlacklistAdapter(HTTPAdapter):
    def is_allowed_url(self, url):
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

    def send(self, request, *args, **kwargs):
        if not self.is_allowed_url(request.url):
            raise SuspiciousOperation('%s matches the URL blacklist' % (request.url,))
        return super(BlacklistAdapter, self).send(request, *args, **kwargs)


def build_session():
    session = requests.Session()
    session.headers.update({'User-Agent': USER_AGENT})
    session.mount('https://', BlacklistAdapter())
    session.mount('http://', BlacklistAdapter())
    return session


def safe_urlopen(url, params=None, data=None, headers=None, allow_redirects=False,
                 timeout=30):
    """
    A slightly safer version of ``urlib2.urlopen`` which prevents redirection
    and ensures the URL isn't attempting to hit a blacklisted IP range.
    """

    session = build_session()
    if data:
        method = session.post
    else:
        method = session.get
    return method(url, headers=headers, params=params, data=data, stream=True,
                  allow_redirects=allow_redirects, timeout=timeout)


def safe_urlread(response):
    return response.content
