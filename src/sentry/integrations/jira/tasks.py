import orjson
from django.db import router, transaction
from taskbroker_client.retry import Retry

from sentry.integrations.jira.forge.client import ForgeInstallationClient
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.service import integration_service
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_control_tasks, integrations_tasks
from sentry.utils.security.encrypted_field_key_store import FernetKeyStore

FORGE_INSTALLATION_PAYLOAD_TTL = 15 * 60


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


@instrumented_task(
    name="sentry.integrations.jira.tasks.sync_forge_installation",
    namespace=integrations_control_tasks,
    # Jira can take a few minutes after an install to grant the app API access, and the
    # Connect `installed` callback that creates the integration can arrive after Forge's.
    retry=Retry(times=5, delay=60, on=(ApiError, Integration.DoesNotExist)),
    expires=FORGE_INSTALLATION_PAYLOAD_TTL,
    silo_mode=SiloMode.CONTROL,
)
def sync_forge_installation(key_id: str, encrypted_payload: str) -> None:
    """Record a site's Forge installation and system token on its Jira integration."""
    payload = orjson.loads(
        FernetKeyStore.get_fernet_for_key_id(key_id).decrypt(
            encrypted_payload.encode(), ttl=FORGE_INSTALLATION_PAYLOAD_TTL
        )
    )
    cloud_id = payload["cloud_id"]
    api_base_url = payload["api_base_url"]
    system_token = payload["system_token"]
    client = ForgeInstallationClient()

    # Forge-only integrations are keyed by cloud ID. Connect integrations keep their
    # clientKey until the cloud ID backfill rekeys them.
    integration = Integration.objects.filter(provider="jira", external_id=cloud_id).first()
    if integration is None:
        try:
            client_key = client.get_connect_client_key(api_base_url, system_token)
        except ApiError as e:
            if e.code != 404:
                raise
            server_info = client.get_server_info(api_base_url, system_token)
            base_url = server_info["baseUrl"]
            integration, _ = Integration.objects.get_or_create(
                provider="jira",
                external_id=cloud_id,
                defaults={
                    "name": server_info["serverTitle"],
                    "metadata": {
                        "base_url": base_url,
                        "domain_name": base_url.replace("https://", ""),
                    },
                },
            )
        else:
            integration = Integration.objects.get(provider="jira", external_id=client_key)

    forge = {
        "cloud_id": cloud_id,
        "installation_id": payload["installation_id"],
        "api_base_url": api_base_url,
        "system_token": system_token,
        "system_token_expires_at": payload["system_token_expires_at"],
    }
    with transaction.atomic(using=router.db_for_write(Integration)):
        integration = Integration.objects.select_for_update().get(id=integration.id)
        existing = integration.metadata.get("forge") or {}
        if existing.get("cloud_id", cloud_id) != cloud_id:
            raise ValueError("Forge cloud ID does not match the existing integration")
        if existing != forge:
            integration.update(metadata={**integration.metadata, "forge": forge})
