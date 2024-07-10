# TODO: delete this whole file once confirming no more of these tasks are floating around anywhere

from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.tasks.reprocess_events",
    queue="events.reprocess_events",
    silo_mode=SiloMode.REGION,
)
def reprocess_events(project_id, **kwargs):
    pass


@instrumented_task(
    name="sentry.tasks.clear_expired_raw_events",
    time_limit=15,
    soft_time_limit=10,
    silo_mode=SiloMode.REGION,
)
def clear_expired_raw_events():
    pass
