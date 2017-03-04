from __future__ import absolute_import

import logging

from django.conf import settings

from requests.exceptions import RequestException

from sentry.http import safe_urlopen
from sentry.lang.native.utils import sdk_info_to_sdk_id


MAX_ATTEMPTS = 3


logger = logging.getLogger(__name__)


def lookup_system_symbols(symbols, sdk_info=None, cpu_name=None):
    """Looks for system symbols in the configured system server if
    enabled.  If this failes or the server is disabled, `None` is
    returned.
    """
    if not settings.SYMBOL_SERVER_ENABLED:
        return

    symbol_query = {
        'sdk_id': sdk_info_to_sdk_id(sdk_info),
        'cpu_name': cpu_name,
        'symbols': symbols,
    }

    attempts = 0
    while 1:
        try:
            rv = safe_urlopen('%s/lookup' % settings.SYMBOL_SERVER_URL.rstrip('/'),
                              method='POST', json=symbol_query)
            rv.raise_for_status()
            return rv.json()['symbols']
        except (IOError, RequestException):
            attempts += 1
            if attempts > MAX_ATTEMPTS:
                logger.error('Failed to contact system symbol server',
                             exc_info=True)
                return
