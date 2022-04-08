from datetime import timedelta
from time import time

from sentry.models import ObjectStatus, OrganizationIntegration
from sentry.tasks.base import instrumented_task, retry


@instrumented_task(
    name="sentry.tasks.integrations.kickoff_vsts_subscription_check",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry()
def kickoff_vsts_subscription_check() -> None:
    from sentry.tasks.integrations import vsts_subscription_check

    organization_integrations = OrganizationIntegration.objects.filter(
        integration__provider="vsts",
        integration__status=ObjectStatus.VISIBLE,
        status=ObjectStatus.VISIBLE,
    ).select_related("integration")

    six_hours_ago = time() - timedelta(hours=6).seconds
    for org_integration in organization_integrations:
        subscription = org_integration.integration.metadata.get("subscription")
        if subscription:
            check = subscription.get("check")
            if not check or check <= six_hours_ago:
                vsts_subscription_check.apply_async(
                    kwargs={
                        "integration_id": org_integration.integration_id,
                        "organization_id": org_integration.organization_id,
                    }
                )
