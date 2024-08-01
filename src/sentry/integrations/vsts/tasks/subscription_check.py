from sentry.integrations.models.integration import Integration
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations.vsts.subscription_check import (
    vsts_subscription_check as old_vsts_subscription_check,
)


@instrumented_task(
    name="sentry.integrations.vsts.tasks.vsts_subscription_check",
    queue="integrations.control",
    default_retry_delay=60 * 5,
    max_retries=5,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(ApiError, ApiUnauthorized, Integration.DoesNotExist))
def vsts_subscription_check(integration_id: int, organization_id: int) -> None:
    old_vsts_subscription_check(integration_id=integration_id, organization_id=organization_id)
