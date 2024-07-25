from sentry.integrations.tasks.vsts.subscription_check import (
    vsts_subscription_check as new_vsts_subscription_check,
)
from sentry.models.integrations.integration import Integration
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.vsts_subscription_check",
    queue="integrations.control",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(ApiError, ApiUnauthorized, Integration.DoesNotExist))
def vsts_subscription_check(integration_id: int, organization_id: int) -> None:
    new_vsts_subscription_check(integration_id, organization_id)
