from __future__ import absolute_import

import logging

from requests.exceptions import RequestException

from sentry import options
from sentry.net.http import Session
from sentry.lang.native.utils import sdk_info_to_sdk_id

MAX_ATTEMPTS = 3

logger = logging.getLogger(__name__)


def lookup_system_symbols(symbols, sdk_info=None, cpu_name=None):
    """Looks for system symbols in the configured system server if
    enabled.  If this failes or the server is disabled, `None` is
    returned.
    """
    if not options.get('symbolserver.enabled'):
        return

    url = '%s/lookup' % options.get('symbolserver.options')['url'].rstrip('/')
    sess = Session()
    symbol_query = {
        'sdk_id': sdk_info_to_sdk_id(sdk_info),
        'cpu_name': cpu_name,
        'symbols': symbols,
    }

    attempts = 0

    with sess:
        while 1:
            try:
                rv = sess.post(url, json=symbol_query)
                # If the symbols server does not know about the SDK at all
                # it will report a 404 here.  In that case just assume
                # that we did not find a match and do not retry.
                if rv.status_code == 404:
                    return None
                rv.raise_for_status()
                return rv.json()['symbols']
            except (IOError, RequestException):
                attempts += 1
                if attempts > MAX_ATTEMPTS:
                    logger.error('Failed to contact system symbol server', exc_info=True)
                    return
