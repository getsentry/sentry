from sentry.sentry_apps.tasks.service_hooks import process_service_hook as new_process_service_hook
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.process_service_hook",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry
def process_service_hook(servicehook_id, event, **kwargs):
    new_process_service_hook(servicehook_id=servicehook_id, event=event, **kwargs)
