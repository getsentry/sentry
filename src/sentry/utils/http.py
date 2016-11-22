"""
sentry.utils.http
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import ipaddress
import six

from collections import namedtuple
from django.conf import settings
from six.moves.urllib.parse import urlencode, urljoin, urlparse

from sentry import options


ParsedUriMatch = namedtuple('ParsedUriMatch', ['scheme', 'domain', 'path'])


def absolute_uri(url=None):
    if not url:
        return options.get('system.url-prefix')
    return urljoin(options.get('system.url-prefix').rstrip('/') + '/', url.lstrip('/'))


def origin_from_url(url):
    if not url:
        return url
    url = urlparse(url)
    return '%s://%s' % (url.scheme, url.netloc)


def safe_urlencode(params, doseq=0):
    """
    UTF-8-safe version of safe_urlencode

    The stdlib safe_urlencode prior to Python 3.x chokes on UTF-8 values
    which can't fail down to ascii.
    """
    # Snippet originally from pysolr: https://github.com/toastdriven/pysolr

    if hasattr(params, "items"):
        params = params.items()

    new_params = list()

    for k, v in params:
        k = k.encode("utf-8")

        if isinstance(v, six.string_types):
            new_params.append((k, v.encode("utf-8")))
        elif isinstance(v, (list, tuple)):
            new_params.append((k, [i.encode("utf-8") for i in v]))
        else:
            new_params.append((k, six.text_type(v)))

    return urlencode(new_params, doseq)


def is_same_domain(url1, url2):
    """
    Returns true if the two urls should be treated as if they're from the same
    domain (trusted).
    """
    url1 = urlparse(url1)
    url2 = urlparse(url2)
    return url1.netloc == url2.netloc


def get_origins(project=None):
    if settings.SENTRY_ALLOW_ORIGIN == '*':
        return frozenset(['*'])

    if settings.SENTRY_ALLOW_ORIGIN:
        result = settings.SENTRY_ALLOW_ORIGIN.split(' ')
    else:
        result = []

    if project:
        optval = project.get_option('sentry:origins', ['*'])
        if optval:
            result.extend(optval)

    # lowercase and strip the trailing slash from all origin values
    # filter out empty values
    return frozenset(filter(bool, map(lambda x: x.lower().rstrip('/'), result)))


def parse_uri_match(value):
    if '://' in value:
        scheme, value = value.split('://', 1)
    else:
        scheme = '*'

    if '/' in value:
        domain, path = value.split('/', 1)
    else:
        domain, path = value, '*'

    if ':' in domain:
        domain, port = value.split(':', 1)
    else:
        port = None

    # we need to coerce our unicode inputs into proper
    # idna/punycode encoded representation for normalization.
    if type(domain) == six.binary_type:
        domain = domain.decode('utf8')
    domain = domain.encode('idna')

    if port:
        domain = '%s:%s' % (domain, port)

    return ParsedUriMatch(scheme, domain, path)


def is_valid_origin(origin, project=None, allowed=None):
    """
    Given an ``origin`` which matches a base URI (e.g. http://example.com)
    determine if a valid origin is present in the project settings.

    Origins may be defined in several ways:

    - http://domain.com[:port]: exact match for base URI (must include port)
    - *: allow any domain
    - *.domain.com: matches domain.com and all subdomains, on any port
    - domain.com: matches domain.com on any port
    - *:port: wildcard on hostname, but explicit match on port
    """
    if allowed is None:
        allowed = get_origins(project)

    if not allowed:
        return False

    if '*' in allowed:
        return True

    if not origin:
        return False

    # we always run a case insensitive check
    origin = origin.lower()

    # Fast check
    if origin in allowed:
        return True

    # XXX: In some cases origin might be localhost (or something similar) which causes a string value
    # of 'null' to be sent as the origin
    if origin == 'null':
        return False

    if type(origin) == six.binary_type:
        origin = origin.decode('utf-8')

    parsed = urlparse(origin)

    # There is no hostname, so the header is probably invalid
    if parsed.hostname is None:
        return False

    try:
        parsed_hostname = parsed.hostname.encode('idna')
    except UnicodeError:
        # We sometimes shove in some garbage input here, so just opting to ignore and carry on
        parsed_hostname = parsed.hostname

    if parsed.port:
        domain_matches = (
            '*', parsed_hostname,
            # Explicit hostname + port name
            '%s:%d' % (parsed_hostname, parsed.port),
            # Wildcard hostname with explicit port
            '*:%d' % parsed.port,
        )
    else:
        domain_matches = ('*', parsed_hostname)

    for value in allowed:
        try:
            bits = parse_uri_match(value)
        except UnicodeError:
            # We hit a bad uri, so ignore this value
            continue

        # scheme supports exact and any match
        if bits.scheme not in ('*', parsed.scheme):
            continue

        # domain supports exact, any, and prefix match
        if bits.domain[:2] == '*.':
            if parsed_hostname.endswith(bits.domain[1:]) or parsed_hostname == bits.domain[2:]:
                return True
            continue
        elif bits.domain not in domain_matches:
            continue

        # path supports exact, any, and suffix match (with or without *)
        path = bits.path
        if path == '*':
            return True
        if path.endswith('*'):
            path = path[:-1]
        if parsed.path.startswith(path):
            return True
    return False


def is_valid_ip(ip_address, project):
    """
    Verify that an IP address is not being blacklisted
    for the given project.
    """
    blacklist = project.get_option('sentry:blacklisted_ips')
    if not blacklist:
        return True

    for addr in blacklist:
        # We want to error fast if it's an exact match
        if ip_address == addr:
            return False

        # Check to make sure it's actually a range before
        if '/' in addr and ipaddress.ip_address(six.text_type(ip_address)) in ipaddress.ip_network(six.text_type(addr), strict=False):
            return False

    return True


def origin_from_request(request):
    """
    Returns either the Origin or Referer value from the request headers,
    ignoring "null" Origins.
    """
    rv = request.META.get('HTTP_ORIGIN', 'null')
    # In some situation, an Origin header may be the literal value
    # "null". This means that the Origin header was stripped for
    # privacy reasons, but we should ignore this value entirely.
    # Behavior is specified in RFC6454. In either case, we should
    # treat a "null" Origin as a nonexistent one and fallback to Referer.
    if rv in ('', 'null'):
        rv = origin_from_url(request.META.get('HTTP_REFERER'))
    return rv
