from time import time

from django.core.exceptions import ObjectDoesNotExist

from sentry.models import Integration
from sentry.models.apitoken import generate_token
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized
from sentry.tasks.base import instrumented_task, retry
from sentry.tasks.integrations import logger


@instrumented_task(
    name="sentry.tasks.integrations.vsts_subscription_check",
    queue="integrations",
    default_retry_delay=60 * 5,
    max_retries=5,
)
@retry(exclude=(ApiError, ApiUnauthorized, Integration.DoesNotExist))
def vsts_subscription_check(integration_id: int, organization_id: int) -> None:
    integration = Integration.objects.get(id=integration_id)
    installation = integration.get_installation(organization_id=organization_id)
    try:
        client = installation.get_client()
    except ObjectDoesNotExist:
        return

    subscription_id = None
    subscription = None
    try:
        subscription_id = integration.metadata["subscription"]["id"]
        subscription = client.get_subscription(
            instance=installation.instance, subscription_id=subscription_id
        )
    except (KeyError, ApiError) as e:
        logger.info(
            "vsts_subscription_check.failed_to_get_subscription",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "error": str(e),
            },
        )

    # https://docs.microsoft.com/en-us/rest/api/vsts/hooks/subscriptions/replace%20subscription?view=vsts-rest-4.1#subscriptionstatus
    if not subscription or subscription["status"] == "disabledBySystem":
        # Update subscription does not work for disabled subscriptions
        # We instead will try to delete and then create a new one.
        if subscription:
            try:
                client.delete_subscription(
                    instance=installation.instance, subscription_id=subscription_id
                )
            except ApiError as e:
                logger.info(
                    "vsts_subscription_check.failed_to_delete_subscription",
                    extra={
                        "integration_id": integration_id,
                        "organization_id": organization_id,
                        "subscription_id": subscription_id,
                        "error": str(e),
                    },
                )

        try:
            secret = generate_token()
            subscription = client.create_subscription(
                instance=installation.instance, shared_secret=secret
            )
        except ApiError as e:
            logger.info(
                "vsts_subscription_check.failed_to_create_subscription",
                extra={
                    "integration_id": integration_id,
                    "organization_id": organization_id,
                    "error": str(e),
                },
            )
        else:
            integration.metadata["subscription"]["id"] = subscription["id"]
            integration.metadata["subscription"]["secret"] = secret
            logger.info(
                "vsts_subscription_check.updated_disabled_subscription",
                extra={
                    "integration_id": integration_id,
                    "organization_id": organization_id,
                    "subscription_id": subscription_id,
                },
            )

        integration.metadata["subscription"]["check"] = time()
        integration.save()
