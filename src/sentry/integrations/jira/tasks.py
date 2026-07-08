from taskbroker_client.retry import Retry

from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.service import integration_service
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_control_tasks, integrations_tasks


@instrumented_task(
    name="sentry.integrations.jira.tasks.migrate_issues",
    namespace=integrations_tasks,
    retry=Retry(times=5, delay=60 * 5, on=(Exception,), ignore=(Integration.DoesNotExist,)),
    silenced_exceptions=(Integration.DoesNotExist,),
)
def migrate_issues(integration_id: int, organization_id: int) -> None:
    result = integration_service.organization_context(
        organization_id=organization_id, integration_id=integration_id
    )
    integration = result.integration
    if not integration:
        raise Integration.DoesNotExist


@instrumented_task(
    name="sentry.integrations.jira.tasks.sync_metadata",
    namespace=integrations_control_tasks,
    retry=Retry(times=5, delay=20, on=(IntegrationError,), ignore=(Integration.DoesNotExist,)),
    silo_mode=SiloMode.CONTROL,
    silenced_exceptions=(Integration.DoesNotExist,),
)
def sync_metadata(integration_id: int) -> None:
    from sentry.integrations.jira.integration import JiraIntegration
    from sentry.integrations.jira_server.integration import JiraServerIntegration

    integration = Integration.objects.get(id=integration_id)
    org_install = integration.organizationintegration_set.first()
    if not org_install:
        return
    installation = integration.get_installation(org_install.organization_id)
    assert isinstance(installation, (JiraIntegration, JiraServerIntegration)), installation
    installation.sync_metadata()
