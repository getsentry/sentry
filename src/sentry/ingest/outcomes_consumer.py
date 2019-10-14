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

import atexit
import logging
import multiprocessing.dummy
import multiprocessing as _multiprocessing

from sentry.utils.batching_kafka_consumer import AbstractBatchWorker

from django.conf import settings
from django.core.cache import cache

from sentry.models.project import Project
from sentry.signals import event_filtered, event_dropped
from sentry.utils.kafka import create_batching_kafka_consumer
from sentry.utils import json
from sentry.utils.outcomes import Outcome

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
    key = _get_signal_cache_key(project_id, event_id)
    cache.set(key, True, 3600)


def is_signal_sent(project_id, event_id):
    """
    Checks a signal was sent previously.
    """
    key = _get_signal_cache_key(project_id, event_id)
    return cache.get(key, None) is not None


def _process_message(message):
    msg = json.loads(message)

    project_id = int(msg.get("project_id", 0))
    if project_id == 0:
        return  # no project. this is valid, so ignore silently.

    outcome = int(msg.get("outcome", -1))
    if outcome not in (Outcome.FILTERED, Outcome.RATE_LIMITED):
        return  # nothing to do here

    event_id = msg.get("event_id")
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


class OutcomesConsumerWorker(AbstractBatchWorker):
    def __init__(self, multiprocessing, concurrency):
        if multiprocessing:
            self.pool = _multiprocessing.Pool()
        else:
            self.pool = _multiprocessing.dummy.Pool()

        atexit.register(self.pool.close)

    def process_message(self, message):
        return message.value()

    def flush_batch(self, batch):
        for _ in self.pool.imap_unordered(_process_message, batch, chunksize=100):
            pass

    def shutdown(self):
        pass


def get_outcomes_consumer(multiprocessing=False, concurrency=None, **options):
    """
    Handles outcome requests coming via a kafka queue from Relay.
    """

    return create_batching_kafka_consumer(
        topic_name=settings.KAFKA_OUTCOMES,
        worker=OutcomesConsumerWorker(multiprocessing=multiprocessing, concurrency=concurrency),
        **options
    )
