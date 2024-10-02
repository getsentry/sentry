from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.servicehooks import process_service_hook as old_process_service_hook


@instrumented_task(
    name="sentry.sentry_apps.tasks.service_hooks.process_service_hook",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.REGION,
)
@retry
def process_service_hook(servicehook_id, event, **kwargs):
    old_process_service_hook(servicehook_id=servicehook_id, event=event, **kwargs)
