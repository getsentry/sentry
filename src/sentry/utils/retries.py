from __future__ import absolute_import

import itertools
import logging
import random
import time


logger = logging.getLogger(__name__)


class RetryPolicy(object):
    def __call__(self, function):
        raise NotImplementedError


class TimedRetryPolicy(RetryPolicy):
    def __init__(self, timeout, delay=None, exceptions=(Exception,)):
        if delay is None:
            delay = lambda i: 0.1 + ((random.random() - 0.5) / 10)

        self.timeout = timeout
        self.delay = delay
        self.exceptions = exceptions

    def __call__(self, function):
        start = time.time()
        for i in itertools.count(1):
            try:
                return function()
            except self.exceptions as error:
                delay = self.delay(i)
                now = time.time()
                if (now + delay) > (start + self.timeout):
                    raise Exception('Could not successfully execute %r within %.3f seconds (%s attempts.)' % (function, now - start, i))
                else:
                    logger.debug(
                        'Failed to execute %r due to %r on attempt #%s, retrying in %s seconds...',
                        function,
                        error,
                        i,
                        delay,
                    )
                    time.sleep(delay)
