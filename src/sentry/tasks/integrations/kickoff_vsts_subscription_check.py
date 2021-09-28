from datetime import timedelta
from time import time

from sentry.models import ObjectStatus, OrganizationIntegration
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations import vsts_subscription_check


@instrumented_task(
    name="sentry.tasks.integrations.kickoff_vsts_subscription_check",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry()
def kickoff_vsts_subscription_check() -> None:
    organization_integrations = OrganizationIntegration.objects.filter(
        integration__provider="vsts",
        integration__status=ObjectStatus.VISIBLE,
        status=ObjectStatus.VISIBLE,
    ).select_related("integration")
    six_hours_ago = time() - timedelta(hours=6).seconds
    for org_integration in organization_integrations:
        organization_id = org_integration.organization_id
        integration = org_integration.integration

        try:
            if (
                "subscription" not in integration.metadata
                or integration.metadata["subscription"]["check"] > six_hours_ago
            ):
                continue
        except KeyError:
            pass

        vsts_subscription_check.apply_async(
            kwargs={"integration_id": integration.id, "organization_id": organization_id}
        )
