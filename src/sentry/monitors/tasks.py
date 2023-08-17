import logging
from datetime import datetime

import msgpack
import sentry_sdk
from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.monitors.constants import SUBTITLE_DATETIME_FORMAT, TIMEOUT
from sentry.monitors.types import ClockPulseMessage
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.utils import metrics, redis
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

from .models import (
    CheckInStatus,
    MonitorCheckIn,
    MonitorEnvironment,
    MonitorFailure,
    MonitorStatus,
    MonitorType,
)

logger = logging.getLogger("sentry")

# This is the MAXIMUM number of MONITOR this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
MONITOR_LIMIT = 10_000

# This is the MAXIMUM number of pending MONITOR CHECKINS this job will check.
#
# NOTE: We should keep an eye on this as we have more and more usage of
# monitors the larger the number of checkins to check will exist.
CHECKINS_LIMIT = 10_000

# This key is used to store the last timestamp that the tasks were triggered.
MONITOR_TASKS_LAST_TRIGGERED_KEY = "sentry.monitors.last_tasks_ts"


def _get_monitor_checkin_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(settings.KAFKA_INGEST_MONITORS)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_checkin_producer = SingletonProducer(_get_monitor_checkin_producer)


def _dispatch_tasks(ts: datetime):
    """
    Dispatch monitor tasks triggered by the consumer clock.

    These tasks are triggered via the consumer processing check-ins. This
    allows the monitor tasks to be synchronized to any backlog of check-ins
    that are being processed.

    To ensure these tasks are always triggered there is an additional celery
    beat task that produces a clock pulse message into the topic that can be
    used to trigger these tasks when there is a low volume of check-ins. It is
    however, preferred to have a high volume of check-ins, so we do not need to
    rely on celery beat, which in some cases may fail to trigger (such as in
    sentry.io, when we deploy we restart the celery beat worker and it will
    skip any tasks it missed)
    """
    check_missing.delay(current_datetime=ts)
    check_timeout.delay(current_datetime=ts)


def try_monitor_tasks_trigger(ts: datetime):
    """
    Handles triggering the monitor tasks when we've rolled over the minute.

    This function is called by our consumer processor
    """
    redis_client = redis.redis_clusters.get(settings.SENTRY_MONITORS_REDIS_CLUSTER)

    # Trim the timestamp seconds off, these tasks are run once per minute and
    # should have their timestamp clamped to the minute.
    reference_datetime = ts.replace(second=0, microsecond=0)
    reference_ts = int(reference_datetime.timestamp())

    precheck_last_ts = redis_client.get(MONITOR_TASKS_LAST_TRIGGERED_KEY)
    if precheck_last_ts is not None:
        precheck_last_ts = int(precheck_last_ts)

    # If we have the same or an older reference timestamp from the most recent
    # tick there is nothing to do, we've already handled this tick.
    #
    # The scenario where the reference_ts is older is likely due to a partition
    # being slightly behind another partition that we've already read from
    if precheck_last_ts is not None and precheck_last_ts >= reference_ts:
        return

    # GETSET is atomic. This is critical to avoid another consumer also
    # processing the same tick.
    last_ts = redis_client.getset(MONITOR_TASKS_LAST_TRIGGERED_KEY, reference_ts)
    if last_ts is not None:
        last_ts = int(last_ts)

    # Another consumer already handled the tick if the first LAST_TRIGGERED
    # timestamp we got is different from the one we just got from the GETSET.
    # Nothing needs to be done
    if precheck_last_ts != last_ts:
        return

    # Track the delay from the true time, ideally this should be pretty
    # close, but in the case of a backlog, this will be much higher
    total_delay = datetime.now().timestamp() - reference_ts

    logger.info(
        "monitors.consumer.clock_tick",
        extra={"reference_datetime": str(reference_datetime)},
    )
    metrics.gauge("monitors.task.clock_delay", total_delay, sample_rate=1.0)

    # If more than exactly a minute has passed then we've skipped a
    # task run, report that to sentry, it is a problem.
    if last_ts is not None and reference_ts > last_ts + 60:
        with sentry_sdk.push_scope() as scope:
            scope.set_extra("last_ts", last_ts)
            scope.set_extra("reference_ts", reference_ts)
            sentry_sdk.capture_message("Monitor task dispatch minute skipped")

    _dispatch_tasks(ts)


@instrumented_task(name="sentry.monitors.tasks.clock_pulse", silo_mode=SiloMode.REGION)
def clock_pulse(current_datetime=None):
    """
    This task is run once a minute when to produce a 'clock pulse' into the
    monitor ingest topic. This is to ensure there is always a message in the
    topic that can drive the clock which dispatches the monitor tasks.
    """
    if current_datetime is None:
        current_datetime = timezone.now()

    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # Directly trigger try_monitor_tasks_trigger in dev
        try_monitor_tasks_trigger(current_datetime)
        return

    message: ClockPulseMessage = {
        "message_type": "clock_pulse",
    }

    # Produce the pulse into the topic
    payload = KafkaPayload(None, msgpack.packb(message), [])
    _checkin_producer.produce(Topic(settings.KAFKA_INGEST_MONITORS), payload)


@instrumented_task(
    name="sentry.monitors.tasks.check_missing",
    time_limit=15,
    soft_time_limit=10,
    silo_mode=SiloMode.REGION,
)
def check_missing(current_datetime=None):
    if current_datetime is None:
        current_datetime = timezone.now()

    # [!!]: We want our reference time to be clamped to the very start of the
    # minute, otherwise we may mark checkins as missed if they didn't happen
    # immediately before this task was run (usually a few seconds into the minute)
    #
    # Because we query `next_checkin_latest__lt=current_datetime` clamping to the
    # minute will ignore monitors that haven't had their checkin yet within
    # this minute.
    current_datetime = current_datetime.replace(second=0, microsecond=0)

    qs = (
        MonitorEnvironment.objects.filter(
            monitor__type__in=[MonitorType.CRON_JOB],
            # [!!]: Note that we use `lt` here to give a whole minute buffer
            # for a check-in to be sent.
            #
            # As an example, if our next_checkin_latest for a monitor was
            # 11:00:00, and our task runs at 11:00:05, the time is clamped down
            # to 11:00:00, and then compared:
            #
            #  next_checkin_latest < 11:00:00
            #
            # Since they are equal this does not match. When the task is run a
            # minute later if the check-in still hasn't been sent we will THEN
            # mark it as missed.
            next_checkin_latest__lt=current_datetime,
        )
        .exclude(
            status__in=[
                MonitorStatus.DISABLED,
                MonitorStatus.PENDING_DELETION,
                MonitorStatus.DELETION_IN_PROGRESS,
            ]
        )
        .exclude(
            monitor__status__in=[
                ObjectStatus.DISABLED,
                ObjectStatus.PENDING_DELETION,
                ObjectStatus.DELETION_IN_PROGRESS,
            ]
        )[:MONITOR_LIMIT]
    )
    metrics.gauge("sentry.monitors.tasks.check_missing.count", qs.count())
    for monitor_environment in qs:
        try:
            logger.info(
                "monitor.missed-checkin", extra={"monitor_environment_id": monitor_environment.id}
            )

            monitor = monitor_environment.monitor
            expected_time = None
            if monitor_environment.last_checkin:
                expected_time = monitor.get_next_expected_checkin(monitor_environment.last_checkin)

            # add missed checkin.
            #
            # XXX(epurkhiser): The date_added is backdated so that this missed
            # check-in correctly reflects the time of when the checkin SHOULD
            # have happened. It is the same as the expected_time.
            MonitorCheckIn.objects.create(
                project_id=monitor_environment.monitor.project_id,
                monitor=monitor_environment.monitor,
                monitor_environment=monitor_environment,
                status=CheckInStatus.MISSED,
                date_added=expected_time,
                expected_time=expected_time,
                monitor_config=monitor.get_validated_config(),
            )
            monitor_environment.mark_failed(
                reason=MonitorFailure.MISSED_CHECKIN,
                occurrence_context={
                    "expected_time": expected_time.strftime(SUBTITLE_DATETIME_FORMAT)
                    if expected_time
                    else expected_time
                },
            )
        except Exception:
            logger.exception("Exception in check_monitors - mark missed", exc_info=True)


@instrumented_task(
    name="sentry.monitors.tasks.check_timeout",
    time_limit=15,
    soft_time_limit=10,
    silo_mode=SiloMode.REGION,
)
def check_timeout(current_datetime=None):
    if current_datetime is None:
        current_datetime = timezone.now()

    current_datetime = current_datetime.replace(second=0, microsecond=0)

    qs = MonitorCheckIn.objects.filter(
        status=CheckInStatus.IN_PROGRESS, timeout_at__lte=current_datetime
    ).select_related("monitor", "monitor_environment")[:CHECKINS_LIMIT]
    metrics.gauge("sentry.monitors.tasks.check_timeout.count", qs.count())
    # check for any monitors which are still running and have exceeded their maximum runtime
    for checkin in qs:
        try:
            monitor_environment = checkin.monitor_environment
            logger.info(
                "monitor_environment.checkin-timeout",
                extra={"monitor_environment_id": monitor_environment.id, "checkin_id": checkin.id},
            )
            affected = checkin.update(status=CheckInStatus.TIMEOUT)
            if not affected:
                continue

            # we only mark the monitor as failed if a newer checkin wasn't responsible for the state
            # change
            has_newer_result = MonitorCheckIn.objects.filter(
                monitor_environment=monitor_environment,
                date_added__gt=checkin.date_added,
                status__in=[CheckInStatus.OK, CheckInStatus.ERROR],
            ).exists()
            if not has_newer_result:
                monitor_environment.mark_failed(
                    reason=MonitorFailure.DURATION,
                    occurrence_context={
                        "duration": (checkin.monitor.config or {}).get("max_runtime") or TIMEOUT,
                        "trace_id": checkin.trace_id,
                    },
                )
        except Exception:
            logger.exception("Exception in check_monitors - mark timeout", exc_info=True)

    # safety check for check-ins stuck in the backlog
    backlog_count = MonitorCheckIn.objects.filter(
        status=CheckInStatus.IN_PROGRESS, timeout_at__isnull=True
    ).count()
    if backlog_count:
        logger.exception(f"Exception in check_monitors - backlog count {backlog_count} is > 0")
