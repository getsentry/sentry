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
from sentry.utils.outcomes import (
    Outcome,
    mark_tsdb_incremented_many,
    tsdb_increments_from_outcome,
    _get_tsdb_cache_key,
)
from sentry.utils.dates import to_datetime, parse_timestamp
from sentry.buffer.redis import batch_buffers_incr
from sentry import tsdb

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
    project_id = int(msg.get("project_id", 0))
    if project_id == 0:
        return  # no project. this is valid, so ignore silently.

    outcome = int(msg.get("outcome", -1))
    if outcome not in (Outcome.FILTERED, Outcome.RATE_LIMITED):
        return  # nothing to do here

    event_id = msg.get("event_id")
    if not event_id:
        return

    if is_signal_sent(project_id=project_id, event_id=event_id):
        return  # message already processed nothing left to do

    try:
        project = Project.objects.get_from_cache(id=project_id)
    except Project.DoesNotExist:
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


def _process_tsdb_batch(messages):
    tsdb_increments = []
    messages_to_process = []
    is_tsdb_incremented_requests = []

    for msg in messages:
        project_id = int(msg.get("project_id") or 0) or None
        event_id = msg.get("event_id")

        if not project_id and not event_id:
            continue

        to_increment = [
            (
                model,
                key,
                {
                    "timestamp": parse_timestamp(msg["timestamp"])
                    if msg.get("timestamp") is not None
                    else to_datetime(time.time())
                },
            )
            for model, key in tsdb_increments_from_outcome(
                org_id=int(msg.get("org_id") or 0) or None,
                project_id=project_id,
                key_id=int(msg.get("key_id") or 0) or None,
                outcome=int(msg.get("outcome", -1)),
                reason=msg.get("reason") or None,
            )
        ]

        if not to_increment:
            continue

        messages_to_process.append((msg, to_increment))
        is_tsdb_incremented_requests.append(_get_tsdb_cache_key(project_id, event_id))

    is_tsdb_incremented_results = cache.get_many(is_tsdb_incremented_requests)

    mark_tsdb_incremented_requests = []

    for (msg, to_increment), should_increment in zip(
        messages_to_process, is_tsdb_incremented_results
    ):
        if should_increment is not None:
            continue

        tsdb_increments.extend(to_increment)
        mark_tsdb_incremented_requests.append((project_id, event_id))
        metrics.incr("outcomes_consumer.tsdb_incremented")

    metrics.timing("outcomes_consumer.tsdb_incr_multi_size", len(tsdb_increments))

    if tsdb_increments:
        tsdb.incr_multi(tsdb_increments)

    if mark_tsdb_incremented_requests:
        mark_tsdb_incremented_many(mark_tsdb_incremented_requests)


class OutcomesConsumerWorker(AbstractBatchWorker):
    def __init__(self, concurrency):
        self.pool = _multiprocessing.dummy.Pool(concurrency)
        atexit.register(self.pool.close)

    def process_message(self, message):
        return json.loads(message.value())

    def flush_batch(self, batch):
        batch.sort(key=lambda msg: msg.get("project_id", 0) or 0)

        with metrics.timer("outcomes_consumer.process_tsdb_batch"):
            _process_tsdb_batch(batch)

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
