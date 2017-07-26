"""
sentry.utils.http
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import sentry

import ipaddress
import six
import socket
import requests
import warnings
import time
import logging

from sentry import options
from django.core.exceptions import SuspiciousOperation
from collections import namedtuple
from django.conf import settings
from requests.adapters import HTTPAdapter
from requests.exceptions import SSLError, RequestException, Timeout, ReadTimeout
from six.moves.urllib.parse import urlparse

from sentry.models import EventError
from sentry.exceptions import RestrictedIPAddress
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text
from sentry.utils.strings import truncatechars

logger = logging.getLogger(__name__)

# TODO(dcramer): we want to change these to be constants so they are easier
# to translate/link again
# the maximum number of remote resources (i.e. sourc eifles) that should be
# fetched
MAX_URL_LENGTH = 150

# UrlResult.body **must** be bytes
UrlResult = namedtuple('UrlResult', ['url', 'headers', 'body', 'status', 'encoding'])

# In case SSL is unavailable (light builds) we can't import this here.
try:
    from OpenSSL.SSL import ZeroReturnError, Error as OpenSSLError
except ImportError:

    class ZeroReturnError(Exception):
        pass

    class OpenSSLError(Exception):
        pass


USER_AGENT = 'sentry/{version} (https://sentry.io)'.format(
    version=sentry.VERSION,
)

DISALLOWED_IPS = {
    ipaddress.ip_network(six.text_type(i), strict=False) for i in settings.SENTRY_DISALLOWED_IPS
}


class BadSource(Exception):
    error_type = EventError.UNKNOWN_ERROR

    def __init__(self, data=None):
        if data is None:
            data = {}
        data.setdefault('type', self.error_type)
        super(BadSource, self).__init__(data['type'])
        self.data = data


class CannotFetch(BadSource):
    error_type = EventError.FETCH_GENERIC_ERROR


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

    # NOTE: The use of `socket.gethostbyname` is slightly flawed.
    # `gethostbyname` doesn't handle octal IP addresses correctly, nor
    # does it fetch all of the IP addresses for the record.
    # `getaddrinfo` does the correct thing with octals here, and also returns all
    # ip addresses for the hostname.
    #
    # WARNING: This behavior is only correct on Linux. On OSX, `getaddrinfo` also
    # returns the wrong IP.
    #
    # The following should all technically resolve to `127.0.0.1`:
    # Python 2.7.11 Linux
    # >>> socket.gethostbyname('0177.0000.0000.0001')
    # '177.0.0.1'
    # >>> socket.getaddrinfo('0177.0000.0000.0001', 0)[0]
    # (2, 1, 6, '', ('127.0.0.1', 0))
    # Python 2.7.11 macOS
    # >>> socket.gethostbyname('0177.0000.0000.0001')
    # '177.0.0.1'
    # >>> socket.getaddrinfo('0177.0000.0000.0001', None)[0]
    # (2, 2, 17, '', ('177.0.0.1', 0))
    try:
        ip_addresses = set(addr for _, _, _, _, addr in socket.getaddrinfo(parsed.hostname, 0))
    except socket.gaierror:
        return False

    for addr in ip_addresses:
        ip_address = addr[0]
        if ip_address == server_hostname:
            return True

        ip_address = ipaddress.ip_address(six.text_type(ip_address))
        for ip_network in DISALLOWED_IPS:
            if ip_address in ip_network:
                return False

    return True


class BlacklistAdapter(HTTPAdapter):
    def send(self, request, *args, **kwargs):
        if not is_valid_url(request.url):
            raise RestrictedIPAddress('%s matches the URL blacklist' % (request.url, ))
        return super(BlacklistAdapter, self).send(request, *args, **kwargs)


class Session(requests.Session):
    def request(self, *args, **kwargs):
        kwargs.setdefault('timeout', 30)
        try:
            response = requests.Session.request(self, *args, **kwargs)
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


class SafeSession(Session):
    def __init__(self):
        requests.Session.__init__(self)
        self.headers.update({'User-Agent': USER_AGENT})
        self.mount('https://', BlacklistAdapter())
        self.mount('http://', BlacklistAdapter())


build_session = SafeSession


def safe_urlopen(
    url,
    method=None,
    params=None,
    data=None,
    json=None,
    headers=None,
    allow_redirects=False,
    timeout=30,
    verify_ssl=True,
    user_agent=None
):
    """
    A slightly safer version of ``urlib2.urlopen`` which prevents redirection
    and ensures the URL isn't attempting to hit a blacklisted IP range.
    """
    if user_agent is not None:
        warnings.warn('user_agent is no longer used with safe_urlopen')

    session = SafeSession()

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

    response = session.request(
        method=method,
        url=url,
        allow_redirects=allow_redirects,
        timeout=timeout,
        verify=verify_ssl,
        **kwargs
    )

    return response


def safe_urlread(response):
    return response.content


def expose_url(url):
    if url is None:
        return u'<unknown>'
    if url[:5] == 'data:':
        return u'<data url>'
    url = truncatechars(url, MAX_URL_LENGTH)
    if isinstance(url, six.binary_type):
        url = url.decode('utf-8', 'replace')
    return url


def fetch_file(
    url,
    domain_lock_enabled=True,
    outfile=None,
    headers=None,
    allow_redirects=True,
    verify_ssl=False,
    timeout=settings.SENTRY_SOURCE_FETCH_SOCKET_TIMEOUT,
    **kwargs
):
    """
    Pull down a URL, returning a UrlResult object.
    """
    # lock down domains that are problematic
    if domain_lock_enabled:
        domain = urlparse(url).netloc
        domain_key = 'source:blacklist:v2:%s' % (md5_text(domain).hexdigest(), )
        domain_result = cache.get(domain_key)
        if domain_result:
            domain_result['url'] = url
            raise CannotFetch(domain_result)

    logger.debug('Fetching %r from the internet', url)

    http_session = build_session()
    response = None

    try:
        try:
            start = time.time()
            response = http_session.get(
                url,
                allow_redirects=allow_redirects,
                verify=verify_ssl,
                headers=headers,
                timeout=timeout,
                stream=True,
                **kwargs
            )

            try:
                cl = int(response.headers['content-length'])
            except (LookupError, ValueError):
                cl = 0
            if cl > settings.SENTRY_SOURCE_FETCH_MAX_SIZE:
                raise OverflowError()

            return_body = False
            if outfile is None:
                outfile = six.BytesIO()
                return_body = True

            cl = 0

            # Only need to even attempt to read the response body if we
            # got a 200 OK
            if response.status_code == 200:
                for chunk in response.iter_content(16 * 1024):
                    if time.time() - start > settings.SENTRY_SOURCE_FETCH_TIMEOUT:
                        raise Timeout()
                    outfile.write(chunk)
                    cl += len(chunk)
                    if cl > settings.SENTRY_SOURCE_FETCH_MAX_SIZE:
                        raise OverflowError()

        except Exception as exc:
            logger.debug('Unable to fetch %r', url, exc_info=True)
            if isinstance(exc, RestrictedIPAddress):
                error = {
                    'type': EventError.RESTRICTED_IP,
                    'url': expose_url(url),
                }
            elif isinstance(exc, SuspiciousOperation):
                error = {
                    'type': EventError.SECURITY_VIOLATION,
                    'url': expose_url(url),
                }
            elif isinstance(exc, (Timeout, ReadTimeout)):
                error = {
                    'type': EventError.FETCH_TIMEOUT,
                    'url': expose_url(url),
                    'timeout': settings.SENTRY_SOURCE_FETCH_TIMEOUT,
                }
            elif isinstance(exc, OverflowError):
                error = {
                    'type': EventError.FETCH_TOO_LARGE,
                    'url': expose_url(url),
                    # We want size in megabytes to format nicely
                    'max_size': float(settings.SENTRY_SOURCE_FETCH_MAX_SIZE) / 1024 / 1024,
                }
            elif isinstance(exc, (RequestException, ZeroReturnError, OpenSSLError)):
                error = {
                    'type': EventError.FETCH_GENERIC_ERROR,
                    'value': six.text_type(type(exc)),
                    'url': expose_url(url),
                }
            else:
                logger.exception(six.text_type(exc))
                error = {
                    'type': EventError.UNKNOWN_ERROR,
                    'url': expose_url(url),
                }

            # TODO(dcramer): we want to be less aggressive on disabling domains
            if domain_lock_enabled:
                cache.set(domain_key, error or '', 300)
                logger.warning('source.disabled', extra=error)
            raise CannotFetch(error)

        headers = {k.lower(): v for k, v in response.headers.items()}
        encoding = response.encoding

        body = None
        if return_body:
            body = outfile.getvalue()
            outfile.close()  # we only want to close StringIO

        result = (headers, body, response.status_code, encoding)
    finally:
        if response is not None:
            response.close()

    if result[2] != 200:
        logger.debug('HTTP %s when fetching %r', result[2], url, exc_info=True)
        error = {
            'type': EventError.FETCH_INVALID_HTTP_CODE,
            'value': result[2],
            'url': expose_url(url),
        }
        raise CannotFetch(error)

    return UrlResult(url, result[0], result[1], result[2], result[3])
