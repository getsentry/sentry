from __future__ import annotations

from functools import partial
from typing import Literal, TypedDict

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, router, transaction
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectSettingPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.managed_ingest_domains.domain_connect import (
    build_cloudflare_domain_connect_url,
    get_cloudflare_domain_connect_config,
    get_detected_dns_provider,
)
from sentry.managed_ingest_domains.providers import (
    PROVIDER_ERROR_STATES,
    get_managed_ingest_provider,
    is_managed_ingest_available,
)
from sentry.models.managed_ingest_domain import ManagedIngestDomain, normalize_hostname
from sentry.models.project import Project
from sentry.tasks.managed_ingest_domains import (
    delete_managed_ingest_domain,
    provision_managed_ingest_domain,
    refresh_managed_ingest_domain,
)
from sentry.utils.http import absolute_uri

type ManagedIngestDomainDiagnosticStatus = Literal["passed", "failed", "waiting"]


class ManagedIngestDomainDiagnosticCheck(TypedDict):
    slug: Literal["provider_hostname", "dns_cname", "certificate", "edge_routing"]
    label: str
    status: ManagedIngestDomainDiagnosticStatus
    summary: str
    expected: str | None
    observed: str | None
    dependsOn: list[str]


class ManagedIngestDomainDiagnostics(TypedDict):
    ranAt: str | None
    checks: list[ManagedIngestDomainDiagnosticCheck]


def _diagnostics(domain: ManagedIngestDomain) -> ManagedIngestDomainDiagnostics:
    provider_failed = domain.provider_status in PROVIDER_ERROR_STATES

    if domain.provider_hostname_id is None:
        provider_status: ManagedIngestDomainDiagnosticStatus = "waiting"
        provider_summary = "Waiting for Sentry to register the hostname."
    elif provider_failed:
        provider_status = "failed"
        provider_summary = domain.last_error or "The provider rejected the hostname."
    else:
        provider_status = "passed"
        provider_summary = "The hostname is registered with the managed ingest provider."

    if domain.provider_hostname_id is None or provider_failed:
        dns_status: ManagedIngestDomainDiagnosticStatus = "waiting"
        dns_summary = "Waiting for provider registration."
    elif domain.provider_status == "active":
        dns_status = "passed"
        dns_summary = "The provider has verified the hostname's DNS configuration."
    elif domain.status == ManagedIngestDomain.Status.ERROR:
        dns_status = "failed"
        dns_summary = domain.last_error or "The provider could not verify the DNS configuration."
    else:
        dns_status = "waiting"
        dns_summary = "Point the hostname to the expected CNAME target, then refresh."

    if dns_status != "passed":
        certificate_status: ManagedIngestDomainDiagnosticStatus = "waiting"
        certificate_summary = "Waiting for DNS verification."
    elif domain.certificate_status == "active":
        certificate_status = "passed"
        certificate_summary = "The managed TLS certificate is active."
    elif domain.status == ManagedIngestDomain.Status.ERROR:
        certificate_status = "failed"
        certificate_summary = domain.last_error or "Certificate issuance failed."
    else:
        certificate_status = "waiting"
        certificate_summary = "Certificate issuance is still in progress."

    edge_active = domain.status == ManagedIngestDomain.Status.ACTIVE
    return {
        "ranAt": domain.last_checked_at.isoformat() if domain.last_checked_at else None,
        "checks": [
            {
                "slug": "provider_hostname",
                "label": "Provider hostname",
                "status": provider_status,
                "summary": provider_summary,
                "expected": "registered",
                "observed": domain.provider_status,
                "dependsOn": [],
            },
            {
                "slug": "dns_cname",
                "label": "DNS CNAME",
                "status": dns_status,
                "summary": dns_summary,
                "expected": (
                    f"{domain.hostname} CNAME {domain.cname_target}"
                    if domain.cname_target
                    else None
                ),
                "observed": domain.provider_status,
                "dependsOn": ["provider_hostname"],
            },
            {
                "slug": "certificate",
                "label": "TLS certificate",
                "status": certificate_status,
                "summary": certificate_summary,
                "expected": "active",
                "observed": domain.certificate_status,
                "dependsOn": ["dns_cname"],
            },
            {
                "slug": "edge_routing",
                "label": "Edge routing",
                "status": "passed" if edge_active else "waiting",
                "summary": (
                    "The hostname's edge authorization mapping is active."
                    if edge_active
                    else "Waiting for the managed TLS certificate."
                ),
                "expected": "active",
                "observed": domain.status,
                "dependsOn": ["certificate"],
            },
        ],
    }


class ManagedIngestDomainSerializer(serializers.ModelSerializer[ManagedIngestDomain]):
    id = serializers.CharField(read_only=True)
    projectId = serializers.CharField(source="project_id", read_only=True)
    providerHostnameId = serializers.CharField(source="provider_hostname_id", read_only=True)
    cnameTarget = serializers.CharField(source="cname_target", read_only=True)
    providerStatus = serializers.CharField(source="provider_status", read_only=True)
    certificateStatus = serializers.CharField(source="certificate_status", read_only=True)
    verificationErrors = serializers.ListField(source="verification_errors", read_only=True)
    lastError = serializers.CharField(source="last_error", read_only=True)
    lastCheckedAt = serializers.DateTimeField(source="last_checked_at", read_only=True)
    activatedAt = serializers.DateTimeField(source="activated_at", read_only=True)
    dateCreated = serializers.DateTimeField(source="date_added", read_only=True)
    dateUpdated = serializers.DateTimeField(source="date_updated", read_only=True)
    diagnostics = serializers.SerializerMethodField()
    dnsProvider = serializers.SerializerMethodField(method_name="get_dns_provider")

    def get_diagnostics(self, domain: ManagedIngestDomain) -> ManagedIngestDomainDiagnostics:
        return _diagnostics(domain)

    def get_dns_provider(self, domain: ManagedIngestDomain) -> str | None:
        return get_detected_dns_provider(domain.hostname)

    class Meta:
        model = ManagedIngestDomain
        fields = (
            "id",
            "projectId",
            "hostname",
            "provider",
            "providerHostnameId",
            "cnameTarget",
            "status",
            "providerStatus",
            "certificateStatus",
            "verificationErrors",
            "lastError",
            "lastCheckedAt",
            "activatedAt",
            "dateCreated",
            "dateUpdated",
            "diagnostics",
            "dnsProvider",
        )


class CreateManagedIngestDomainData(TypedDict):
    hostname: str


class CreateManagedIngestDomainSerializer(serializers.Serializer[CreateManagedIngestDomainData]):
    hostname = serializers.CharField(max_length=253)

    def validate_hostname(self, hostname: str) -> str:
        try:
            return normalize_hostname(hostname)
        except DjangoValidationError as error:
            raise serializers.ValidationError(error.messages) from error


class ProjectManagedIngestDomainBaseEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    permission_classes = (ProjectSettingPermission,)

    def ensure_available(self) -> None:
        if not is_managed_ingest_available():
            raise ResourceDoesNotExist


@cell_silo_endpoint
class ProjectManagedIngestDomainEndpoint(ProjectManagedIngestDomainBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project) -> Response:
        self.ensure_available()
        domain = ManagedIngestDomain.objects.filter(project_id=project.id).first()
        return Response(
            {"domain": (ManagedIngestDomainSerializer(domain).data if domain is not None else None)}
        )

    def post(self, request: Request, project: Project) -> Response:
        self.ensure_available()
        if project.organization.get_option("sentry:relay_dsn_endpoint"):
            return Response(
                {"detail": "Managed ingest cannot be used with a Relay DSN endpoint override."},
                status=status.HTTP_409_CONFLICT,
            )
        if (
            project.organization.get_option("sentry:ingest-through-trusted-relays-only")
            == "enabled"
        ):
            return Response(
                {"detail": "Managed ingest cannot be used with trusted-Relay-only ingestion."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = CreateManagedIngestDomainSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        hostname: str = serializer.validated_data["hostname"]

        existing = ManagedIngestDomain.objects.filter(project_id=project.id).first()
        if existing is not None:
            if existing.hostname == hostname:
                return Response({"domain": ManagedIngestDomainSerializer(existing).data})
            return Response(
                {"detail": "This project already has a managed ingest domain."},
                status=status.HTTP_409_CONFLICT,
            )

        provider = get_managed_ingest_provider()
        database = router.db_for_write(ManagedIngestDomain)
        try:
            with transaction.atomic(using=database):
                domain = ManagedIngestDomain.objects.create(
                    project=project,
                    hostname=hostname,
                    provider=provider.name,
                )
                transaction.on_commit(
                    partial(provision_managed_ingest_domain.delay, domain.id),
                    using=database,
                )
        except IntegrityError:
            return Response(
                {"detail": "This hostname is already registered."},
                status=status.HTTP_409_CONFLICT,
            )

        return Response(
            {"domain": ManagedIngestDomainSerializer(domain).data},
            status=status.HTTP_202_ACCEPTED,
        )

    def delete(self, request: Request, project: Project) -> Response:
        self.ensure_available()
        domain = ManagedIngestDomain.objects.filter(project_id=project.id).first()
        if domain is None:
            return Response({"domain": None})

        database = router.db_for_write(ManagedIngestDomain)
        with transaction.atomic(using=database):
            domain.transition_to(ManagedIngestDomain.Status.DELETING)
            domain.save(update_fields=["status", "date_updated"])
            transaction.on_commit(
                partial(delete_managed_ingest_domain.delay, domain.id),
                using=database,
            )
        return Response(
            {"domain": ManagedIngestDomainSerializer(domain).data},
            status=status.HTTP_202_ACCEPTED,
        )


@cell_silo_endpoint
class ProjectManagedIngestDomainRefreshEndpoint(ProjectManagedIngestDomainBaseEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def post(self, request: Request, project: Project) -> Response:
        self.ensure_available()
        try:
            domain = ManagedIngestDomain.objects.get(project_id=project.id)
        except ManagedIngestDomain.DoesNotExist:
            raise ResourceDoesNotExist

        task = (
            refresh_managed_ingest_domain
            if domain.provider_hostname_id is not None
            else provision_managed_ingest_domain
        )
        task.delay(domain.id)
        return Response(
            {"domain": ManagedIngestDomainSerializer(domain).data},
            status=status.HTTP_202_ACCEPTED,
        )


@cell_silo_endpoint
class ProjectManagedIngestDomainConnectEndpoint(ProjectManagedIngestDomainBaseEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, project: Project) -> Response:
        self.ensure_available()
        config = get_cloudflare_domain_connect_config()
        if config is None:
            raise ResourceDoesNotExist

        try:
            domain = ManagedIngestDomain.objects.get(project_id=project.id)
        except ManagedIngestDomain.DoesNotExist:
            raise ResourceDoesNotExist

        if domain.cname_target is None:
            return Response(
                {"detail": "The managed ingest domain is not ready for DNS configuration."},
                status=status.HTTP_409_CONFLICT,
            )

        if get_detected_dns_provider(domain.hostname) != "cloudflare":
            raise ResourceDoesNotExist

        redirect_uri = absolute_uri(
            f"/settings/{project.organization.slug}/projects/{project.slug}/custom-ingest-domain/"
        )
        return Response(
            {
                "provider": "cloudflare",
                "url": build_cloudflare_domain_connect_url(
                    domain.hostname,
                    domain.cname_target,
                    redirect_uri,
                    config,
                ),
            }
        )
