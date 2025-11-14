from typing import int
import logging

from sentry.codecov.client import CodecovApiClient, ConfigurationError, GitProvider
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import integrations_control_tasks
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)

account_unlink_endpoint = "/sentry/internal/account/unlink/"


@instrumented_task(
    name="sentry.integrations.github.tasks.codecov_account_unlink",
    namespace=integrations_control_tasks,
    retry=Retry(times=3),
    processing_deadline_duration=60,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(ConfigurationError,))
def codecov_account_unlink(
    integration_id: int,
    organization_ids: list[int],
) -> None:
    """
    Unlinks a GitHub integration from Codecov.

    :param integration_id: The GitHub integration ID
    :param organization_ids: The Sentry organization IDs
    """

    integration = integration_service.get_integration(
        integration_id=integration_id, status=ObjectStatus.DISABLED
    )
    if not integration:
        logger.warning(
            "codecov.account_unlink.missing_integration", extra={"integration_id": integration_id}
        )
        return

    github_org_name = integration.name

    try:
        codecov_client = CodecovApiClient(
            git_provider_org=github_org_name, git_provider=GitProvider.GitHub
        )

        request_data = {
            "sentry_org_ids": [str(organization_id) for organization_id in organization_ids],
        }

        response = codecov_client.post(
            endpoint=account_unlink_endpoint,
            json=request_data,
        )

        response.raise_for_status()

        logger.info(
            "codecov.account_unlink.success",
            extra={
                "github_org": github_org_name,
                "integration_id": integration_id,
                "sentry_organization_ids": organization_ids,
            },
        )

    except ConfigurationError:
        logger.exception(
            "codecov.account_unlink.configuration_error",
            extra={
                "github_org": github_org_name,
                "integration_id": integration_id,
            },
        )
        return

    except Exception as e:
        logger.exception(
            "codecov.account_unlink.unexpected_error",
            extra={
                "github_org": github_org_name,
                "integration_id": integration_id,
                "error": str(e),
                "error_type": type(e).__name__,
            },
        )
        return
