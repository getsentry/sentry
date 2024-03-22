import zoneinfo
from datetime import UTC

from django.utils import timezone


def make_ref_time(**kwargs):
    """
    To accurately reflect the real usage of our check tasks, we want the ref
    time to be truncated down to a minute for our tests.
    """
    tz_name = kwargs.pop("timezone", "UTC")

    ts = timezone.now().replace(**kwargs, tzinfo=zoneinfo.ZoneInfo(tz_name))

    # Typically the task will not run exactly on the minute, but it will
    # run very close, let's say for our test that it runs 12 seconds after
    # the minute.
    #
    # This is testing that the task correctly clamps its reference time
    # down to the minute.
    #
    # Task timestamps are in UTC, convert our reference time to UTC for this
    task_run_ts = ts.astimezone(UTC).replace(second=12, microsecond=0)

    # Fan-out tasks recieve a floored version of the timestamp
    sub_task_run_ts = task_run_ts.replace(second=0)

    # We truncate down to the minute when we mark the next_checkin, do the
    # same here.
    trimmed_ts = ts.replace(second=0, microsecond=0)

    return task_run_ts, sub_task_run_ts, trimmed_ts
