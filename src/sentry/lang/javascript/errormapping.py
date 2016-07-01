import re
import cgi
import json
import logging

from django.conf import settings
from django.core.cache import cache

from sentry import http


logger = logging.getLogger(__name__)


error_processors = {}


class Processor(object):

    def __init__(self, vendor, mapping_url, regex, func):
        self.vendor = vendor
        self.mapping_url = mapping_url
        self.regex = re.compile(regex)
        self.func = func

    def load_mapping(self):
        key = 'javascript.errormapping:%s' % self.vendor
        mapping = cache.get(key)
        if mapping is not None:
            return json.loads(mapping)

        http_session = http.build_session()
        response = http_session.get(self.mapping_url,
            allow_redirects=True,
            verify=False,
            timeout=settings.SENTRY_SOURCE_FETCH_TIMEOUT,
        )
        data = response.json()
        cache.set(key, json.dumps(data), 300)
        return data

    def try_process(self, exc):
        match = self.regex.search(exc['value'])
        if match is None:
            return False
        mapping = self.load_mapping()
        return self.func(exc, match, mapping)


def minified_error(vendor, mapping_url, regex):
    def decorator(f):
        error_processors[vendor] = Processor(vendor, mapping_url, regex, f)
    return decorator


@minified_error(
    vendor='react',
    mapping_url=('https://raw.githubusercontent.com/facebook/'
                 'react/master/scripts/error-codes/codes.json'),
    regex=r'Minified React error #(\d+); visit https?://[^?]+\?(\S+)'
)
def process_react_exception(exc, match, mapping):
    error_id, qs = match.groups()
    msg_format = mapping.get(error_id)
    if msg_format is None:
        return False
    args = []
    for k, v in cgi.parse_qsl(qs):
        if k == 'args[]':
            args.append(v)
    exc['value'] = msg_format % tuple(args)
    return True


def rewrite_exception(data):
    """Rewrite an exception in an event if needed.  Updates the exception
    in place and returns `True` if a modification was performed or `False`
    otherwise.
    """
    exc_data = data.get('sentry.interfaces.Exception')
    if not exc_data:
        return False

    rv = False
    for exc in exc_data['values']:
        for processor in error_processors.itervalues():
            try:
                if processor.try_process(exc):
                    rv = True
                    break
            except Exception as e:
                logger.error('Failed to run processor "%s": %s',
                             processor.vendor, e, exc_info=True)

    return rv
