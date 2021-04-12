import logging
import time
import warnings
from collections import namedtuple
from io import BytesIO
from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import SuspiciousOperation
from requests.exceptions import ReadTimeout, RequestException, Timeout

from sentry import options
from sentry.exceptions import RestrictedIPAddress
from sentry.models import EventError
from sentry.net.http import SafeSession

# Importing for backwards compatible API
from sentry.net.socket import is_safe_hostname, is_valid_url, safe_socket_connect  # NOQA
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text
from sentry.utils.strings import truncatechars

logger = logging.getLogger(__name__)

# TODO(dcramer): we want to change these to be constants so they are easier
# to translate/link again
# the maximum number of remote resources (i.e. source files) that should be
# fetched
MAX_URL_LENGTH = 150

# UrlResult.body **must** be bytes
UrlResult = namedtuple("UrlResult", ["url", "headers", "body", "status", "encoding"])


class BadSource(Exception):
    error_type = EventError.UNKNOWN_ERROR

    def __init__(self, data=None):
        if data is None:
            data = {}
        data.setdefault("type", self.error_type)
        super().__init__(data["type"])
        self.data = data


class CannotFetch(BadSource):
    error_type = EventError.FETCH_GENERIC_ERROR


def get_server_hostname():
    return urlparse(options.get("system.url-prefix")).hostname


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
    user_agent=None,
):
    """
    A slightly safer version of ``urlib2.urlopen`` which prevents redirection
    and ensures the URL isn't attempting to hit a blacklisted IP range.
    """
    if user_agent is not None:
        warnings.warn("user_agent is no longer used with safe_urlopen")

    with SafeSession() as session:
        kwargs = {}

        if json:
            kwargs["json"] = json
            if not headers:
                headers = {}
            headers.setdefault("Content-Type", "application/json")

        if data:
            kwargs["data"] = data

        if params:
            kwargs["params"] = params

        if headers:
            kwargs["headers"] = headers

        if method is None:
            method = "POST" if (data or json) else "GET"

        response = session.request(
            method=method,
            url=url,
            allow_redirects=allow_redirects,
            timeout=timeout,
            verify=verify_ssl,
            **kwargs,
        )

        return response


def safe_urlread(response):
    return response.content


def expose_url(url):
    if url is None:
        return "<unknown>"
    if url[:5] == "data:":
        return "<data url>"
    url = truncatechars(url, MAX_URL_LENGTH)
    if isinstance(url, bytes):
        url = url.decode("utf-8", "replace")
    return url


def get_domain_key(url):
    domain = urlparse(url).netloc
    return f"source:blacklist:v2:{md5_text(domain).hexdigest()}"


def lock_domain(url, error=None):
    error = dict(error or {})
    if error.get("type") is None:
        error["type"] = EventError.UNKNOWN_ERROR
    if error.get("url") is None:
        error["url"] = expose_url(url)
    domain_key = get_domain_key(url)
    cache.set(domain_key, error, 300)
    logger.warning("source.disabled", extra=error)


def fetch_file(
    url,
    domain_lock_enabled=True,
    outfile=None,
    headers=None,
    allow_redirects=True,
    verify_ssl=False,
    timeout=settings.SENTRY_SOURCE_FETCH_SOCKET_TIMEOUT,
    **kwargs,
):
    """
    Pull down a URL, returning a UrlResult object.
    """
    # lock down domains that are problematic
    if domain_lock_enabled:
        domain_key = get_domain_key(url)
        domain_result = cache.get(domain_key)
        if domain_result:
            domain_result["url"] = url
            raise CannotFetch(domain_result)

    logger.debug("Fetching %r from the internet", url)

    with SafeSession() as http_session:
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
                    **kwargs,
                )

                try:
                    cl = int(response.headers["content-length"])
                except (LookupError, ValueError):
                    cl = 0
                if cl > settings.SENTRY_SOURCE_FETCH_MAX_SIZE:
                    raise OverflowError()

                return_body = False
                if outfile is None:
                    outfile = BytesIO()
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
                logger.debug("Unable to fetch %r", url, exc_info=True)
                if isinstance(exc, RestrictedIPAddress):
                    error = {"type": EventError.RESTRICTED_IP}
                elif isinstance(exc, SuspiciousOperation):
                    error = {"type": EventError.SECURITY_VIOLATION}
                elif isinstance(exc, (Timeout, ReadTimeout)):
                    error = {
                        "type": EventError.FETCH_TIMEOUT,
                        "timeout": settings.SENTRY_SOURCE_FETCH_TIMEOUT,
                    }
                elif isinstance(exc, OverflowError):
                    error = {
                        "type": EventError.FETCH_TOO_LARGE,
                        # We want size in megabytes to format nicely
                        "max_size": float(settings.SENTRY_SOURCE_FETCH_MAX_SIZE) / 1024 / 1024,
                    }
                elif isinstance(exc, RequestException):
                    error = {
                        "type": EventError.FETCH_GENERIC_ERROR,
                        "value": f"{type(exc)}",
                    }
                else:
                    logger.exception(f"{exc}")
                    error = {"type": EventError.UNKNOWN_ERROR}

                # TODO(dcramer): we want to be less aggressive on disabling domains
                if domain_lock_enabled:
                    lock_domain(url, error)
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

        return UrlResult(url, result[0], result[1], result[2], result[3])
