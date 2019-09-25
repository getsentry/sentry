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

import logging

from django.conf import settings

from sentry.models.project import Project
from sentry.signals import event_filtered, event_dropped
from sentry.utils.kafka import SimpleKafkaConsumer
from sentry.utils import json
from sentry.utils.outcomes import is_outcome_signal_sent, mark_outcome_signal_sent, Outcome

logger = logging.getLogger(__name__)


class OutcomesConsumer(SimpleKafkaConsumer):
    def process_message(self, message):
        msg = json.loads(message.value())

        project_id = int(msg.get("project_id", 0))

        if project_id == 0:
            return  # no project

        event_id = msg.get("event_id")

        if is_outcome_signal_sent(project_id=project_id, event_id=event_id):
            return  # message already processed nothing left to do

        outcome = int(msg.get("outcome", -1))
        reason = msg.get("reason")
        remote_addr = msg.get("remote_addr")

        if outcome == Outcome.FILTERED or outcome == Outcome.RATE_LIMITED:
            # try to get the project
            try:
                project = Project.objects.get_from_cache(id=project_id)
            except Project.DoesNotExist:
                logger.error("OutcomeConsumer could not find project with id: %s", project_id)
                return

            if outcome == Outcome.FILTERED:
                event_filtered.send_robust(
                    ip=remote_addr, project=project, sender=self.process_message
                )

            elif outcome == Outcome.RATE_LIMITED:
                event_dropped.send_robust(
                    ip=remote_addr, project=project, reason_code=reason, sender=self.process_message
                )

        # remember that we sent the signal just in case the processor dies before
        mark_outcome_signal_sent(project_id=project_id, event_id=event_id)


def run_outcomes_consumer(
    commit_batch_size,
    consumer_group,
    max_fetch_time_seconds,
    initial_offset_reset,
    is_shutdown_requested=lambda: False,
):
    """
    Handles outcome requests coming via a kafka queue from Relay.

    :param commit_batch_size: the number of message the consumer will try to process/commit in one loop
    :param consumer_group: kafka consumer group name
    :param max_fetch_time_seconds: the maximum number of seconds a consume operation will be blocked waiting
        for the specified commit_batch_size number of messages to appear in the queue before it returns. At the
        end of the specified time the consume operation will return however many messages it has ( including
        an empty array if no new messages are available).
    :param initial_offset_reset: offset reset policy when there's no available offset for the consumer
    :param is_shutdown_requested: Callable[[],bool] predicate checked after each loop, if it returns
        True the forwarder stops (by default is lambda: False). In normal operation this should be left to default.
        For unit testing it offers a way to cleanly stop the forwarder after some particular condition is achieved.
    """

    logger.debug("Starting outcomes-consumer...")
    topic_name = settings.KAFKA_OUTCOMES

    outcomes_consumer = OutcomesConsumer(
        commit_batch_size=commit_batch_size,
        consumer_group=consumer_group,
        topic_name=topic_name,
        max_fetch_time_seconds=max_fetch_time_seconds,
        initial_offset_reset=initial_offset_reset,
    )

    outcomes_consumer.run(is_shutdown_requested)

    logger.debug("outcomes-consumer terminated.")
