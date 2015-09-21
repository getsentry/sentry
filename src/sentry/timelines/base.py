import logging
from collections import namedtuple

from sentry.utils.imports import import_string


logger = logging.getLogger('sentry.timelines')


Record = namedtuple('Record', 'key value timestamp')


def load(options):
    return import_string(options['path'])(**options.get('options', {}))


class Backend(object):
    def __init__(self, **options):
        self.codec = load(options.pop('codec', {'path': 'sentry.timelines.codecs.CompressedPickleCodec'}))
        self.backoff = load(options.pop('backoff', {'path': 'sentry.timelines.backoff.IntervalBackoffStrategy'}))

        self.capacity = options.pop('capacity', None)
        if self.capacity is not None and self.capacity < 1:
            raise ValueError('Timeline capacity must be at least 1 if used.')

        if self.capacity:
            self.trim_chance = options.pop('trim_chance', 1.0 / self.capacity)
        else:
            self.trim_chance = None
            if 'trim_chance' in options:
                logger.warning('No timeline capacity has been set, ignoring "trim_chance" option.')
                del options['trim_chance']
