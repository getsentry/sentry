from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations.vsts.kickoff_subscription_check import (
    kickoff_vsts_subscription_check as old_kickoff_vsts_subscription_check,
)


@instrumented_task(
    name="sentry.integrations.vsts.tasks.kickoff_vsts_subscription_check",
    queue="integrations.control",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.CONTROL,
)
@retry()
def kickoff_vsts_subscription_check() -> None:
    old_kickoff_vsts_subscription_check()
