from typing import int
from time import time

from django.core.exceptions import ObjectDoesNotExist

from sentry.auth.exceptions import IdentityNotValid
from sentry.integrations.models.integration import Integration
from sentry.integrations.tasks import logger
from sentry.models.apitoken import generate_token
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import integrations_control_tasks
from sentry.taskworker.retry import Retry


@instrumented_task(
    name="sentry.integrations.vsts.tasks.vsts_subscription_check",
    namespace=integrations_control_tasks,
    retry=Retry(times=5, delay=60 * 5),
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(ApiError, ApiUnauthorized, Integration.DoesNotExist, IdentityNotValid))
def vsts_subscription_check(integration_id: int, organization_id: int) -> None:
    from sentry.integrations.vsts.integration import VstsIntegration

    integration = Integration.objects.get(id=integration_id)
    installation = integration.get_installation(organization_id=organization_id)
    assert isinstance(installation, VstsIntegration), installation
    try:
        client = installation.get_client()
    except ObjectDoesNotExist:
        return

    subscription_id = None
    subscription = None
    try:
        subscription_id = integration.metadata["subscription"]["id"]
        subscription = client.get_subscription(subscription_id=subscription_id)
    except (KeyError, ApiError) as e:
        logger.info(
            "vsts_subscription_check.failed_to_get_subscription",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "error": str(e),
            },
        )
    except IdentityNotValid as e:
        logger.info(
            "vsts_subscription_check.identity_not_valid",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "error": str(e),
            },
        )
        # There is no point in continuing this task if the identity is not valid.
        # The integration is fundamentally broken
        return

    # https://docs.microsoft.com/en-us/rest/api/vsts/hooks/subscriptions/replace%20subscription?view=vsts-rest-4.1#subscriptionstatus
    if not subscription or subscription["status"] == "disabledBySystem":
        # Update subscription does not work for disabled subscriptions
        # We instead will try to delete and then create a new one.
        if subscription and subscription_id is not None:
            try:
                client.delete_subscription(subscription_id=subscription_id)
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
            subscription = client.create_subscription(shared_secret=secret)
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
