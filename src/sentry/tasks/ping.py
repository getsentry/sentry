"""
sentry.tasks.ping
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import, print_function

import sentry

from time import time

from sentry import options
from sentry.tasks.base import instrumented_task


@instrumented_task(name='sentry.tasks.send_ping')
def send_ping():
    options.set('sentry:last_worker_ping', time())
    options.set('sentry:last_worker_version', sentry.VERSION)
