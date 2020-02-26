"""
The OutcomeConsumer is a task that runs a loop in which it reads outcome messages coming on a kafka queue and
processes them.

Long Story: Event outcomes are placed on the same Kafka event queue by both Sentry and Relay.
When Sentry generates an outcome for a message it also sends a signal ( a Django signal) that
is used by getSentry for internal accounting.

Relay (running as a Rust process) cannot send django signals so in order to get outcome signals sent from
Relay into getSentry we have this outcome consumers which listens to all outcomes in the kafka queue and
for outcomes that were sent from Relay sends the signals to getSentry.

In conclusion the OutcomeConsumer listens on the the outcomes kafka topic, filters the outcomes by dropping
the outcomes that originate from sentry and keeping the outcomes originating in relay and sends
signals to getSentry for these outcomes.

"""
from __future__ import absolute_import

import six

import time
import atexit
import logging
import multiprocessing.dummy
import multiprocessing as _multiprocessing

from sentry.utils.batching_kafka_consumer import AbstractBatchWorker

from django.conf import settings
from django.core.cache import cache

from sentry.models.project import Project
from sentry.db.models.manager import BaseManager
from sentry.signals import event_filtered, event_dropped
from sentry.utils.kafka import create_batching_kafka_consumer
from sentry.utils import json, metrics
from sentry.utils.outcomes import Outcome
from sentry.utils.dates import to_datetime, parse_timestamp
from sentry.buffer.redis import batch_buffers_incr

logger = logging.getLogger(__name__)


def _get_signal_cache_key(project_id, event_id):
    return "signal:{}:{}".format(project_id, event_id)


def mark_signal_sent(project_id, event_id):
    """
    Remembers that a signal was emitted.

    Sets a boolean flag to remember (for one hour) that a signal for a
    particular event id (in a project) was sent. This is used by the signals
    forwarder to avoid double-emission.

    :param project_id: :param event_id: :return:
    """
    assert isinstance(project_id, six.integer_types)
    key = _get_signal_cache_key(project_id, event_id)
    cache.set(key, True, 3600)


def is_signal_sent(project_id, event_id):
    """
    Checks a signal was sent previously.
    """
    key = _get_signal_cache_key(project_id, event_id)
    return cache.get(key, None) is not None


def _process_signal(msg):
    project_id = int(msg.get("project_id") or 0)
    if project_id == 0:
        metrics.incr("outcomes_consumer.skip_outcome", tags={"reason": "project_zero"})
        return  # no project. this is valid, so ignore silently.

    outcome = int(msg.get("outcome", -1))
    if outcome not in (Outcome.FILTERED, Outcome.RATE_LIMITED):
        metrics.incr("outcomes_consumer.skip_outcome", tags={"reason": "wrong_outcome_type"})
        return  # nothing to do here

    event_id = msg.get("event_id")
    if not event_id:
        metrics.incr("outcomes_consumer.skip_outcome", tags={"reason": "missing_event_id"})
        return

    if is_signal_sent(project_id=project_id, event_id=event_id):
        metrics.incr("outcomes_consumer.skip_outcome", tags={"reason": "is_signal_sent"})
        return  # message already processed nothing left to do

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
        metrics.incr("outcomes_consumer.skip_outcome", tags={"reason": "unknown_project"})
        logger.error("OutcomesConsumer could not find project with id: %s", project_id)
        return

    reason = msg.get("reason")
    remote_addr = msg.get("remote_addr")

    if outcome == Outcome.FILTERED:
        event_filtered.send_robust(ip=remote_addr, project=project, sender=OutcomesConsumerWorker)
    elif outcome == Outcome.RATE_LIMITED:
        event_dropped.send_robust(
            ip=remote_addr, project=project, reason_code=reason, sender=OutcomesConsumerWorker
        )

    # remember that we sent the signal just in case the processor dies before
    mark_signal_sent(project_id=project_id, event_id=event_id)

    timestamp = msg.get("timestamp")
    if timestamp is not None:
        delta = to_datetime(time.time()) - parse_timestamp(timestamp)
        metrics.timing("outcomes_consumer.timestamp_lag", delta.total_seconds())

    metrics.incr("outcomes_consumer.signal_sent", tags={"reason": reason, "outcome": outcome})


def _process_signal_with_timer(message):
    with metrics.timer("outcomes_consumer.process_signal"):
        return _process_signal(message)


class OutcomesConsumerWorker(AbstractBatchWorker):
    def __init__(self, concurrency):
        self.pool = _multiprocessing.dummy.Pool(concurrency)
        atexit.register(self.pool.close)

    def process_message(self, message):
        return json.loads(message.value())

    def flush_batch(self, batch):
        batch.sort(key=lambda msg: msg.get("project_id", 0) or 0)

        with metrics.timer("outcomes_consumer.process_signal_batch"):
            with batch_buffers_incr():
                with BaseManager.local_cache():
                    for _ in self.pool.imap_unordered(
                        _process_signal_with_timer, batch, chunksize=100
                    ):
                        pass

    def shutdown(self):
        pass


def get_outcomes_consumer(concurrency=None, **options):
    """
    Handles outcome requests coming via a kafka queue from Relay.
    """

    return create_batching_kafka_consumer(
        topic_name=settings.KAFKA_OUTCOMES,
        worker=OutcomesConsumerWorker(concurrency=concurrency),
        **options
    )
