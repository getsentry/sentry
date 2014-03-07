"""
sentry.tasks.check_version
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import json
import logging

from simplejson import JSONDecodeError

from sentry.tasks.base import instrumented_task
from sentry.tasks.fetch_source import fetch_url_content, BAD_SOURCE

PYPI_URL = 'https://pypi.python.org/pypi/sentry/json'

logger = logging.getLogger(__name__)


@instrumented_task(name='sentry.tasks.check_update', queue='update')
def check_update():
    """
    Daily retrieving latest available Sentry version from PyPI
    """
    from sentry.receivers import set_sentry_version

    result = fetch_url_content(PYPI_URL)

    if result == BAD_SOURCE:
        return

    try:
        (_, _, body) = result

        version = json.loads(body)['info']['version']
        set_sentry_version(version)
    except JSONDecodeError:
        logger.warning('Failed parsing data json from PYPI')
    except Exception:
        logger.warning('Failed update info of latest version Sentry')
