from sentry.integrations.vsts.tasks.kickoff_subscription_check import (
    kickoff_vsts_subscription_check as new_kickoff_vsts_subscription_check,
)
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.kickoff_vsts_subscription_check",
    queue="integrations.control",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.CONTROL,
)
@retry()
def kickoff_vsts_subscription_check() -> None:
    new_kickoff_vsts_subscription_check()
