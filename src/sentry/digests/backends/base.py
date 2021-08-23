import logging
from typing import TYPE_CHECKING, Any, Iterable, Mapping, Optional

from sentry.utils.imports import import_string
from sentry.utils.services import Service

if TYPE_CHECKING:
    from sentry.digests import Record, ScheduleEntry
    from sentry.models import Project

logger = logging.getLogger("sentry.digests")


def load(options: Mapping[str, str]) -> Any:
    return import_string(options["path"])(**options.get("options", {}))


DEFAULT_CODEC = {"path": "sentry.digests.codecs.CompressedPickleCodec"}


class InvalidState(Exception):
    """
    An error that is raised when an action cannot be performed on a
    timeline in it's current state.
    """


class Backend(Service):  # type: ignore
    """
    A digest backend coordinates the addition of records to timelines, as well
    as scheduling their digestion (processing.) This allows for summarizations
    of activity that was recorded as having occurred during a window of time.

    A timeline is the central abstraction for digests. A timeline is a
    reverse-chronological set of records. Timelines are identified by a unique
    key. Records within a timeline are also identified by a key that is unique
    with respect to the timeline they are a part of.

    A timeline can be in one of two states: "waiting" or "ready".

    When the first record is added to a timeline, the timeline transitions to
    the "ready" state, and the digest is immediately available to be digested
    and delivered. (This immediate state change to "ready" allows notifications
    to be delivered with lower latency.)

    After delivery, the digest transitions to the "waiting" state for the
    duration of the delay interval. If more items are added to the digest
    during this waiting period, the schedule is extended incrementally (up to
    the value defined by the maximum delay option) to allow grouping the more
    items into a single notification.

    When the "waiting" period is over, the timeline transitions back to the
    "ready" state, which causes the timeline to be again digested and
    delivered. After the timeline is digested, it transitions back to the
    "waiting" state if it contained records. If the timeline did not contain
    any records when it was digested, it can be deleted (although deletion may
    be preempted by a new record being added to the timeline, requiring it to
    be transitioned to "waiting" instead.)
    """

    __all__ = ("add", "delete", "digest", "enabled", "maintenance", "schedule", "validate")

    def __init__(self, **options: Any) -> None:
        # The ``minimum_delay`` option defines the default minimum amount of
        # time (in seconds) to wait between scheduling digests for delivery
        # after the initial scheduling.
        self.minimum_delay = options.pop("minimum_delay", 60 * 5)

        # The ``maximum_delay`` option defines the default maximum amount of
        # time (in seconds) to wait between scheduling digests for delivery.
        self.maximum_delay = options.pop("maximum_delay", 60 * 30)

        # The ``increment_delay`` option defines how long each observation of
        # an event should delay scheduling (up until the ``maximum_delay``
        # after the last time a digest was processed.)
        self.increment_delay = options.pop("increment_delay", 30)

        # The ``codec`` option provides the strategy for encoding and decoding
        # records in the timeline.
        self.codec = load(options.pop("codec", DEFAULT_CODEC))

        # The ``capacity`` option defines the maximum number of items that
        # should be contained within a timeline. (Whether this is a hard or
        # soft limit is backend dependent -- see the ``truncation_chance`` option.)
        self.capacity = options.pop("capacity", None)
        if self.capacity is not None and self.capacity < 1:
            raise ValueError("Timeline capacity must be at least 1 if used.")

        # The ``truncation_chance`` option defines the probability that an
        # ``add`` operation will trigger a truncation of the timeline to keep
        # it's size close to the defined capacity. A value of 1 will cause the
        # timeline to be truncated on every ``add`` operation (effectively
        # making it a hard limit), while a lower probability will increase the
        # chance of the timeline growing past it's intended capacity, but
        # increases the performance of ``add`` operations (by avoiding
        # truncation, which is a potentially expensive operation, especially on
        # large data sets.)
        if self.capacity:
            self.truncation_chance = options.pop("truncation_chance", 1.0 / self.capacity)
        else:
            if options.get("truncation_chance") is not None:
                raise TypeError(
                    'No timeline capacity has been set, "truncation_chance" must be None.'
                )
            else:
                self.truncation_chance = 0.0

    def enabled(self, project: "Project") -> bool:
        """
        Check if a project has digests enabled.
        """
        return True

    def add(
        self,
        key: str,
        record: "Record",
        increment_delay: Optional[int] = None,
        maximum_delay: Optional[int] = None,
        timestamp: Optional[float] = None,
    ) -> bool:
        """
        Add a record to a timeline.

        Adding a record to a timeline also causes it to be added to the
        schedule, if it is not already present.

        If another record exists in the timeline with the same record key, it
        will be overwritten.

        The return value this function indicates whether or not the timeline is
        ready for immediate digestion.
        """
        raise NotImplementedError

    def digest(self, key: str, minimum_delay: Optional[int] = None) -> Any:
        """
        Extract records from a timeline for processing.

        This method acts as a context manager. The target of the ``as`` clause
        is an iterator contains all of the records contained within the digest.

        If the context manager successfully exits, all records that were part
        of the digest are removed from the timeline and the timeline is placed
        back in the "waiting" state. If an exception is raised during the
        execution of the context manager, all records are preserved and no
        state change occurs so that the next invocation will contain all
        records that the were included previously, as well as any records that
        were added in between invocations. (This means that the caller must
        either retry the digest operation until it succeeds, or wait for the
        operation to be rescheduled as part of the maintenance process for the
        items to be processed.)

        Typically, the block that is surrounded by context manager includes all
        of the processing logic necessary to summarize the timeline contents
        (since this process is generally has no side effects), while any
        irrevocable action -- such as sending an email -- should occur after
        the context manager has exited, to ensure that action is performed at
        most once.

        For example::

            with timelines.digest('project:1') as records:
                message = build_digest_email(records)

            message.send_async()

        """
        raise NotImplementedError

    def schedule(
        self, deadline: float, timestamp: Optional[float] = None
    ) -> Optional[Iterable["ScheduleEntry"]]:
        """
        Identify timelines that are ready for processing.

        This method moves all timelines that are ready to be digested from the
        waiting state to the ready state if their schedule time is prior to the
        deadline. This method returns an iterator of schedule entries that were
        moved.
        """
        raise NotImplementedError

    def maintenance(self, deadline: float, timestamp: Optional[float] = None) -> None:
        """
        Identify timelines that appear to be stuck in the ready state.

        This method moves all timelines that are in the ready state back to the
        waiting state if their schedule time is prior to the deadline. (This
        does not reschedule any tasks directly, and should generally be
        performed as part of the scheduler task, before the ``schedule``
        call.)

        This is designed to handle the situation where task execution is
        managed by a separate system such as RabbitMQ & Celery from scheduling.
        A digest task may not be able to be successfully retried after a failure
        (e.g. if the process executing the task can no longer communicate with
        the messaging broker) which can result in a task remaining in the ready
        state without an execution plan.

        This may cause issues when asynchronously processing timelines and
        there is a severe backlog of timelines to be digested. Timelines in the
        "ready" state that were scheduled for execution prior to the deadline
        may still have outstanding tasks associated with them -- remember that
        without the ability to interrogate the queue, we are unable to identify
        if these tasks have finished but were unable to be removed from the
        schedule, failed outright, or are still pending. As part of
        maintenance, those timelines are moved back to the "waiting" state for
        rescheduling, and if a pending task for a timeline that was previously
        in the "ready" state but is now back in the "waiting" state actually
        executes, it will fail to be executed. The timeline will later be moved
        back to the "ready" state and rescheduled -- so it's contents will
        eventually be processed -- but this may be significantly delayed from
        the originally scheduled time. Both the queue backlog as well as the
        frequency of the digest task raising an exception when a timeline is in
        an invalid state should be monitored. If these exceptions happen
        frequently -- especially during periods of abnormal queue growth -- the
        frequency of maintenance tasks should be decreased, or the deadline
        should be pushed further towards the past (execution grace period
        increased) or both.
        """
        raise NotImplementedError

    def delete(self, key: str) -> None:
        """
        Delete a timeline and all of it's contents from the database.
        """
        raise NotImplementedError
