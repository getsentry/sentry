from __future__ import annotations

from django.utils import timezone

from sentry.managed_ingest_domains.domain_connect import detect_dns_provider
from sentry.managed_ingest_domains.providers import (
    PROVIDER_ERROR_STATES,
    EdgeConfig,
    ManagedIngestProvider,
    ProviderHostname,
    get_managed_ingest_provider,
)
from sentry.models.managed_ingest_domain import ManagedIngestDomain
from sentry.models.projectkey import ProjectKey, ProjectKeyStatus, UseCase
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks

_PENDING_STATUSES = frozenset(
    {
        ManagedIngestDomain.Status.PENDING_DNS,
        ManagedIngestDomain.Status.PENDING_CERTIFICATE,
    }
)
_POLL_DELAY_SECONDS = 30


def _edge_config(domain: ManagedIngestDomain, *, enabled: bool) -> EdgeConfig:
    public_keys = [
        key.public_key
        for key in ProjectKey.objects.filter(
            project_id=domain.project_id,
            status=ProjectKeyStatus.ACTIVE,
            use_case=UseCase.USER.value,
        )
        if key.public_key is not None
    ]
    return {
        "v": 1,
        "enabled": enabled,
        "organization_id": str(domain.project.organization_id),
        "region": "us",
        "projects": {str(domain.project_id): public_keys},
        "updated_at": timezone.now().isoformat(),
    }


def _status(hostname: ProviderHostname) -> ManagedIngestDomain.Status:
    if hostname.status in PROVIDER_ERROR_STATES:
        return ManagedIngestDomain.Status.ERROR
    if hostname.status != "active":
        return ManagedIngestDomain.Status.PENDING_DNS
    if hostname.certificate_status != "active":
        return ManagedIngestDomain.Status.PENDING_CERTIFICATE
    return ManagedIngestDomain.Status.ACTIVE


def _record_hostname(
    domain: ManagedIngestDomain,
    provider: ManagedIngestProvider,
    hostname: ProviderHostname,
) -> ManagedIngestDomain.Status:
    target_status = _status(hostname)
    if target_status == ManagedIngestDomain.Status.ACTIVE:
        provider.put_edge_config(domain.hostname, _edge_config(domain, enabled=True))
    elif domain.status == ManagedIngestDomain.Status.ACTIVE:
        provider.put_edge_config(domain.hostname, _edge_config(domain, enabled=False))
        target_status = ManagedIngestDomain.Status.ERROR

    domain.provider_hostname_id = hostname.id
    domain.cname_target = provider.cname_target
    domain.provider_status = hostname.status
    domain.certificate_status = hostname.certificate_status
    domain.verification_errors = list(hostname.verification_errors)
    last_error = hostname.verification_errors[0] if hostname.verification_errors else None
    if (
        target_status == ManagedIngestDomain.Status.PENDING_DNS
        and last_error
        and last_error.removesuffix(".") == "custom hostname does not CNAME to this zone"
    ):
        last_error = None
    domain.last_error = last_error
    domain.last_checked_at = timezone.now()
    domain.transition_to(target_status)
    domain.save(
        update_fields=[
            "provider_hostname_id",
            "cname_target",
            "provider_status",
            "certificate_status",
            "verification_errors",
            "last_error",
            "last_checked_at",
            "status",
            "activated_at",
            "date_updated",
        ]
    )
    return target_status


@instrumented_task(
    name="sentry.tasks.managed_ingest_domains.provision_managed_ingest_domain",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
)
def provision_managed_ingest_domain(domain_id: int) -> None:
    domain = (
        ManagedIngestDomain.objects.select_related("project")
        .exclude(status=ManagedIngestDomain.Status.DELETING)
        .filter(id=domain_id)
        .first()
    )
    if domain is None:
        return

    provider = get_managed_ingest_provider()
    hostname = (
        provider.get_hostname(domain.provider_hostname_id)
        if domain.provider_hostname_id
        else provider.create_hostname(domain.hostname)
    )
    target_status = _record_hostname(domain, provider, hostname)
    detect_dns_provider(domain.hostname)
    if target_status in _PENDING_STATUSES and provider.name != "fake":
        provision_managed_ingest_domain.apply_async(
            args=[domain.id],
            countdown=_POLL_DELAY_SECONDS,
        )


@instrumented_task(
    name="sentry.tasks.managed_ingest_domains.refresh_managed_ingest_domain",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
)
def refresh_managed_ingest_domain(domain_id: int) -> None:
    domain = (
        ManagedIngestDomain.objects.select_related("project")
        .exclude(status=ManagedIngestDomain.Status.DELETING)
        .filter(id=domain_id)
        .first()
    )
    if domain is None or domain.provider_hostname_id is None:
        return

    provider = get_managed_ingest_provider()
    target_status = _record_hostname(
        domain,
        provider,
        provider.refresh_hostname(domain.provider_hostname_id),
    )
    detect_dns_provider(domain.hostname)
    if target_status in _PENDING_STATUSES:
        provision_managed_ingest_domain.apply_async(
            args=[domain.id],
            countdown=_POLL_DELAY_SECONDS,
        )


@instrumented_task(
    name="sentry.tasks.managed_ingest_domains.reconcile_managed_ingest_domain",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
)
def reconcile_managed_ingest_domain(project_id: int) -> None:
    domain = (
        ManagedIngestDomain.objects.select_related("project")
        .filter(
            project_id=project_id,
            status=ManagedIngestDomain.Status.ACTIVE,
        )
        .first()
    )
    if domain is None:
        return

    get_managed_ingest_provider().put_edge_config(
        domain.hostname,
        _edge_config(domain, enabled=True),
    )


@instrumented_task(
    name="sentry.tasks.managed_ingest_domains.delete_managed_ingest_domain",
    namespace=integrations_tasks,
    silo_mode=SiloMode.CELL,
)
def delete_managed_ingest_domain(domain_id: int) -> None:
    domain = ManagedIngestDomain.objects.select_related("project").filter(id=domain_id).first()
    if domain is None:
        return

    provider = get_managed_ingest_provider()
    provider.put_edge_config(domain.hostname, _edge_config(domain, enabled=False))
    if domain.provider_hostname_id:
        provider.delete_hostname(domain.provider_hostname_id)
    provider.delete_edge_config(domain.hostname)
    domain.delete()
