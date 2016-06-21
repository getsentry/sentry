"""
sentry.utils.http
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import sentry
import six
import socket
import requests
import warnings

from sentry import options
from django.conf import settings
from ipaddr import IPNetwork
from requests.adapters import HTTPAdapter
from requests.exceptions import SSLError
from sentry.exceptions import RestrictedIPAddress

# In case SSL is unavailable (light builds) we can't import this here.
try:
    from OpenSSL.SSL import ZeroReturnError
except ImportError:
    class ZeroReturnError(Exception):
        pass

from urlparse import urlparse

USER_AGENT = 'sentry/{version} (https://getsentry.com)'.format(
    version=sentry.VERSION,
)

DISALLOWED_IPS = set((IPNetwork(i) for i in settings.SENTRY_DISALLOWED_IPS))


def get_server_hostname():
    return urlparse(options.get('system.url-prefix')).hostname


def is_valid_url(url):
    """
    Tests a URL to ensure it doesn't appear to be a blacklisted IP range.
    """
    # If we have no disallowed ips, we can skip any further validation
    # and there's no point in doing a DNS lookup to validate against
    # an empty list.
    if not DISALLOWED_IPS:
        return True

    parsed = urlparse(url)
    if not parsed.hostname:
        return False

    server_hostname = get_server_hostname()

    if parsed.hostname == server_hostname:
        return True

    try:
        ip_address = socket.gethostbyname(parsed.hostname)
    except socket.gaierror:
        return False

    if ip_address == server_hostname:
        return True

    ip_network = IPNetwork(ip_address)
    for addr in DISALLOWED_IPS:
        if ip_network in addr:
            return False

    return True


class BlacklistAdapter(HTTPAdapter):
    def send(self, request, *args, **kwargs):
        if not is_valid_url(request.url):
            raise RestrictedIPAddress('%s matches the URL blacklist' % (request.url,))
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

    try:
        response = session.request(
            method=method,
            url=url,
            allow_redirects=allow_redirects,
            timeout=timeout,
            verify=verify_ssl,
            **kwargs
        )
    # Our version of requests does not transform ZeroReturnError into an
    # appropriately generically catchable exception
    except ZeroReturnError as exc:
        import sys
        exc_tb = sys.exc_info()[2]
        six.reraise(SSLError, exc, exc_tb)
        del exc_tb

    # requests' attempts to use chardet internally when no encoding is found
    # and we want to avoid that slow behavior
    if not response.encoding:
        response.encoding = 'utf-8'

    return response


def safe_urlread(response):
    return response.content
