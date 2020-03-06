from __future__ import absolute_import

import logging
import pytest
import six

from sentry.ingest.outcomes_consumer import get_outcomes_consumer, mark_signal_sent, is_signal_sent
from sentry.signals import event_filtered, event_discarded, event_dropped, event_saved
from sentry.testutils.factories import Factories
from sentry.utils.outcomes import Outcome
from django.conf import settings
from sentry.utils import json
from sentry.utils.json import prune_empty_keys
from sentry.utils.data_filters import FilterStatKeys


logger = logging.getLogger(__name__)

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
MAX_POLL_ITERATIONS = 50

group_counter = 0


def _get_next_group_id():
    """
    Returns a unique kafka consumer group identifier, which is required to get
    tests passing.
    """
    global group_counter
    group_counter += 1
    return "test-outcome-consumer-%s" % group_counter


def _get_event_id(base_event_id):
    return "{:032}".format(int(base_event_id))


class OutcomeTester(object):
    def __init__(self, kafka_producer, kafka_admin, task_runner):
        self.events_filtered = []
        self.events_discarded = []
        self.events_dropped = []
        self.events_saved = []

        event_filtered.connect(self._event_filtered_receiver)
        event_discarded.connect(self._event_discarded_receiver)
        event_dropped.connect(self._event_dropped_receiver)
        event_saved.connect(self._event_saved_receiver)

        self.task_runner = task_runner
        self.topic_name = settings.KAFKA_OUTCOMES
        self.organization = Factories.create_organization()
        self.project = Factories.create_project(organization=self.organization)

        self.producer = self._create_producer(kafka_producer, kafka_admin)

    def track_outcome(
        self,
        event_id=None,
        key_id=None,
        outcome=None,
        reason=None,
        remote_addr=None,
        timestamp=None,
    ):
        message = {
            "project_id": self.project.id,
            "org_id": self.organization.id,
            "event_id": event_id,
            "key_id": key_id,
            "outcome": outcome,
            "reason": reason,
            "remote_addr": remote_addr,
            "timestamp": timestamp,
        }

        message = json.dumps(prune_empty_keys(message))
        self.producer.produce(self.topic_name, message)

    def run(self, predicate=None):
        if predicate is None:
            predicate = lambda: True

        consumer = get_outcomes_consumer(
            max_batch_size=1,
            max_batch_time=100,
            group_id=_get_next_group_id(),
            auto_offset_reset="earliest",
        )

        with self.task_runner():
            i = 0
            while predicate() and i < MAX_POLL_ITERATIONS:
                consumer._run_once()
                i += 1

        # Verify that we consumed everything and didn't time out
        # assert not predicate()
        assert i < MAX_POLL_ITERATIONS

    def _event_filtered_receiver(self, **kwargs):
        self.events_filtered.append(kwargs)

    def _event_discarded_receiver(self, **kwargs):
        self.events_discarded.append(kwargs)

    def _event_dropped_receiver(self, **kwargs):
        self.events_dropped.append(kwargs)

    def _event_saved_receiver(self, **kwargs):
        self.events_saved.append(kwargs)

    def _create_producer(self, kafka_producer, kafka_admin):
        # Clear the topic to ensure we run in a pristine environment
        admin = kafka_admin(settings)
        admin.delete_topic(self.topic_name)

        producer = kafka_producer(settings)
        return producer


@pytest.fixture
def outcome_tester(requires_kafka, kafka_producer, kafka_admin, task_runner):
    return OutcomeTester(kafka_producer, kafka_admin, task_runner)


@pytest.mark.django_db
def test_outcome_consumer_ignores_outcomes_already_handled(outcome_tester):
    # put a few outcome messages on the kafka topic and also mark them in the cache
    for i in range(4):
        event_id = _get_event_id(i)

        if i < 2:
            # pretend that we have already processed this outcome before
            project_id = outcome_tester.project.id
            mark_signal_sent(project_id=project_id, event_id=event_id)

        outcome_tester.track_outcome(
            event_id=event_id,
            outcome=Outcome.FILTERED,
            reason="some_reason",
            remote_addr="127.33.44.{}".format(i),
        )

    project_id = outcome_tester.project.id
    outcome_tester.run(lambda: not is_signal_sent(project_id, event_id))

    # verify that no signal was called (since the events have been previously processed)
    ips = [outcome["ip"] for outcome in outcome_tester.events_filtered]
    assert ips == ["127.33.44.2", "127.33.44.3"]
    assert not outcome_tester.events_dropped
    assert not outcome_tester.events_saved


@pytest.mark.django_db
def test_outcome_consumer_ignores_invalid_outcomes(outcome_tester):
    # Add two FILTERED items so we know when the producer has reached the end
    for i in range(4):
        outcome_tester.track_outcome(
            event_id=_get_event_id(i),
            outcome=Outcome.INVALID if i < 2 else Outcome.FILTERED,
            reason="some_reason",
            remote_addr="127.33.44.{}".format(i),
        )

    outcome_tester.run(lambda: len(outcome_tester.events_filtered) < 2)

    # verify that the appropriate filters were called
    ips = [outcome["ip"] for outcome in outcome_tester.events_filtered]
    assert ips == ["127.33.44.2", "127.33.44.3"]
    assert not outcome_tester.events_dropped
    assert not outcome_tester.events_saved


@pytest.mark.django_db
def test_outcome_consumer_remembers_handled_outcomes(outcome_tester):
    for i in six.moves.range(1, 3):
        # emit the same outcome twice (simulate the case when the producer goes
        # down without committing the kafka offsets and is restarted)
        outcome_tester.track_outcome(
            event_id=_get_event_id(i),
            outcome=Outcome.FILTERED,
            reason="some_reason",
            remote_addr="127.33.44.{}".format(1),
        )

    outcome_tester.run(lambda: len(outcome_tester.events_filtered) < 1)

    ips = [outcome["ip"] for outcome in outcome_tester.events_filtered]
    assert ips == ["127.33.44.1"]  # only once!
    assert not outcome_tester.events_dropped
    assert not outcome_tester.events_saved


@pytest.mark.django_db
def test_outcome_consumer_handles_filtered_outcomes(outcome_tester):
    for i in six.moves.range(1, 3):
        outcome_tester.track_outcome(
            event_id=_get_event_id(i),
            outcome=Outcome.FILTERED,
            reason="some_reason",
            remote_addr="127.33.44.{}".format(i),
        )

    outcome_tester.run(lambda: len(outcome_tester.events_filtered) < 2)

    # verify that the appropriate filters were called
    ips = [outcome["ip"] for outcome in outcome_tester.events_filtered]
    assert len(ips) == 2
    assert set(ips) == set(["127.33.44.1", "127.33.44.2"])
    assert not outcome_tester.events_dropped
    assert not outcome_tester.events_saved


@pytest.mark.django_db
def test_outcome_consumer_handles_rate_limited_outcomes(outcome_tester):
    for i in six.moves.range(1, 3):
        outcome_tester.track_outcome(
            event_id=_get_event_id(i),
            outcome=Outcome.RATE_LIMITED,
            reason="reason_{}".format(i),
            remote_addr="127.33.44.{}".format(i),
        )

    outcome_tester.run(lambda: len(outcome_tester.events_dropped) < 2)

    assert not outcome_tester.events_filtered
    tuples = [(o["ip"], o["reason_code"]) for o in outcome_tester.events_dropped]
    assert set(tuples) == set([("127.33.44.1", "reason_1"), ("127.33.44.2", "reason_2")])


@pytest.mark.django_db
def test_outcome_consumer_handles_accepted_outcomes(outcome_tester):
    for i in six.moves.range(1, 3):
        outcome_tester.track_outcome(
            event_id=_get_event_id(i),
            outcome=Outcome.ACCEPTED,
            remote_addr="127.33.44.{}".format(i),
        )

    outcome_tester.run(lambda: len(outcome_tester.events_saved) < 2)

    assert not outcome_tester.events_filtered
    assert len(outcome_tester.events_saved) == 2


@pytest.mark.django_db
def test_outcome_consumer_handles_discarded_outcomes(outcome_tester):
    for i in six.moves.range(4):
        if i < 2:
            reason = "something_else"
        else:
            reason = FilterStatKeys.DISCARDED_HASH

        outcome_tester.track_outcome(
            event_id=_get_event_id(i),
            outcome=Outcome.FILTERED,
            reason=reason,
            remote_addr="127.33.44.{}".format(i),
        )

    outcome_tester.run(lambda: len(outcome_tester.events_discarded) < 2)

    assert len(outcome_tester.events_filtered) == 2
    assert len(outcome_tester.events_discarded) == 2
