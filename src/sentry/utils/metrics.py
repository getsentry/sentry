from __future__ import absolute_import

__all__ = ['timing', 'incr']

from contextlib import contextmanager
from django.conf import settings
from random import random
from time import time
import logging


def get_default_backend():
    from sentry.utils.imports import import_string

    cls = import_string(settings.SENTRY_METRICS_BACKEND)

    return cls(**settings.SENTRY_METRICS_OPTIONS)

backend = get_default_backend()


def _get_key(key):
    prefix = settings.SENTRY_METRICS_PREFIX
    if prefix:
        return '{}{}'.format(prefix, key)
    return key


def _should_sample():
    sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE

    return sample_rate >= 1 or random() >= 1 - sample_rate


def _sampled_value(value):
    sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE
    if sample_rate < 1:
        value = int(value * (1.0 / sample_rate))
    return value


def _incr_internal(key, instance=None, tags=None, amount=1):
    from sentry.app import tsdb

    if _should_sample():
        amount = _sampled_value(amount)
        if instance:
            full_key = '{}.{}'.format(key, instance)
        else:
            full_key = key

        try:
            tsdb.incr(tsdb.models.internal, full_key, count=amount)
        except Exception:
            logger = logging.getLogger('sentry.errors')
            logger.exception('Unable to incr internal metric')


def incr(key, amount=1, instance=None, tags=None):
    sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE
    _incr_internal(key, instance, tags, amount)
    try:
        backend.incr(key, instance, tags, amount, sample_rate)
    except Exception:
        logger = logging.getLogger('sentry.errors')
        logger.exception('Unable to record backend metric')


def timing(key, value, instance=None, tags=None):
    # TODO(dcramer): implement timing for tsdb
    # TODO(dcramer): implement sampling for timing
    sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE
    try:
        backend.timing(key, value, instance, tags, sample_rate)
    except Exception:
        logger = logging.getLogger('sentry.errors')
        logger.exception('Unable to record backend metric')


@contextmanager
def timer(key, instance=None, tags=None):
    if tags is None:
        tags = {}

    start = time()
    try:
        yield tags
    except Exception:
        tags['result'] = 'failure'
        raise
    else:
        tags['result'] = 'success'
    finally:
        timing(key, time() - start, instance, tags)
