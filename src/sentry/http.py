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
import warnings

from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from ipaddr import IPNetwork
from requests.adapters import HTTPAdapter
from urlparse import urlparse

USER_AGENT = 'sentry/{version} (https://getsentry.com)'.format(
    version=sentry.VERSION,
)

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


class BlacklistAdapter(HTTPAdapter):
    def send(self, request, *args, **kwargs):
        if not is_valid_url(request.url):
            raise SuspiciousOperation('%s matches the URL blacklist' % (request.url,))
        return super(BlacklistAdapter, self).send(request, *args, **kwargs)


def build_session():
    session = requests.Session()
    session.headers.update({'User-Agent': USER_AGENT})
    session.mount('https://', BlacklistAdapter())
    session.mount('http://', BlacklistAdapter())
    return session


def safe_urlopen(url, method=None, params=None, data=None, json=None,
                 headers=None, allow_redirects=False, timeout=30,
                 verify_ssl=True, user_agent=None):
    """
    A slightly safer version of ``urlib2.urlopen`` which prevents redirection
    and ensures the URL isn't attempting to hit a blacklisted IP range.
    """
    if user_agent is not None:
        warnings.warn('user_agent is no longer used with safe_urlopen')

    session = build_session()

    kwargs = {}

    if json:
        kwargs['json'] = json
        if not headers:
            headers = {}
        headers.setdefault('Content-Type', 'application/json')

    if data:
        kwargs['data'] = data

    if params:
        kwargs['params'] = params

    if headers:
        kwargs['headers'] = headers

    if method is None:
        method = 'POST' if (data or json) else 'GET'

    return getattr(session, method.lower())(
        url,
        allow_redirects=allow_redirects,
        timeout=timeout,
        verify=verify_ssl,
        **kwargs
    )


def safe_urlread(response):
    return response.content
