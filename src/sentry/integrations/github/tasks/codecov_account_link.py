from typing import int
import logging

from sentry.codecov.client import CodecovApiClient, ConfigurationError, GitProvider
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task, retry
from sentry.taskworker.namespaces import (
    integrations_control_tasks,
    integrations_control_throttled_tasks,
)
from sentry.taskworker.retry import Retry

logger = logging.getLogger(__name__)

account_link_endpoint = "/sentry/internal/account/link/"


@instrumented_task(
    name="sentry.integrations.github.tasks.codecov_account_link",
    namespace=integrations_control_tasks,
    retry=Retry(times=3),
    processing_deadline_duration=60,
    silo_mode=SiloMode.CONTROL,
)
@retry(exclude=(ConfigurationError,))
def codecov_account_link(
    integration_id: int,
    organization_id: int,
) -> None:
    link_codecov_account(integration_id, organization_id)


@instrumented_task(
    name="sentry.integrations.github.tasks.backfill_codecov_account_link",
    silo_mode=SiloMode.CONTROL,
    namespace=integrations_control_throttled_tasks,
    retry=Retry(times=3),
    processing_deadline_duration=60,
)
@retry(exclude=(ConfigurationError,))
def backfill_codecov_account_link(
    integration_id: int,
    organization_id: int,
) -> None:
    link_codecov_account(integration_id, organization_id)


def link_codecov_account(
    integration_id: int,
    organization_id: int,
) -> None:
    """
    Links a GitHub integration to Codecov.

    :param integration_id: The GitHub integration ID
    :param organization_id: The Sentry organization ID
    """

    integration = integration_service.get_integration(
        integration_id=integration_id, status=ObjectStatus.ACTIVE
    )
    if not integration:
        logger.warning(
            "codecov.account_link.missing_integration", extra={"integration_id": integration_id}
        )
        return

    rpc_org = organization_service.get(id=organization_id)
    if rpc_org is None:
        logger.warning(
            "codecov.account_link.missing_organization", extra={"organization_id": organization_id}
        )
        return

    # From GitHubIntegrationProvider, src/sentry/integrations/github/integration.py:693
    github_org_name = integration.name

    try:
        codecov_client = CodecovApiClient(
            git_provider_org=github_org_name, git_provider=GitProvider.GitHub
        )

        service_id = integration.metadata.get("account_id")
        if not service_id:
            logger.warning(
                "codecov.account_link.missing_service_id",
                extra={
                    "integration_id": integration_id,
                    "github_org": github_org_name,
                },
            )
            return

        request_data = {
            "sentry_org_id": str(organization_id),
            "sentry_org_name": rpc_org.name,
            "organizations": [
                {
                    "installation_id": integration.external_id,
                    "service_id": str(service_id),
                    "slug": github_org_name,
                    "provider": IntegrationProviderSlug.GITHUB.value,
                }
            ],
        }

        response = codecov_client.post(
            endpoint=account_link_endpoint,
            json=request_data,
        )

        response.raise_for_status()

        logger.info(
            "codecov.account_link.success",
            extra={
                "github_org": github_org_name,
                "integration_id": integration_id,
                "sentry_organization_id": organization_id,
            },
        )

    except ConfigurationError:
        logger.exception(
            "codecov.account_link.configuration_error",
            extra={
                "github_org": github_org_name,
                "integration_id": integration_id,
            },
        )
        return

    except Exception as e:
        logger.exception(
            "codecov.account_link.unexpected_error",
            extra={
                "github_org": github_org_name,
                "integration_id": integration_id,
                "error": str(e),
                "error_type": type(e).__name__,
            },
        )
        return
