from __future__ import annotations

import re
from ipaddress import ip_address
from typing import Any

from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from tldextract import TLDExtract

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, cell_silo_model, sane_repr

__all__ = ("ManagedIngestDomain", "normalize_hostname")

_extract_domain = TLDExtract(cache_dir=None, suffix_list_urls=(), fallback_to_snapshot=True)
_hostname_label = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")


def normalize_hostname(value: str) -> str:
    hostname = value.strip().removesuffix(".")

    try:
        hostname = hostname.encode("idna").decode("ascii").lower()
    except UnicodeError as error:
        raise ValidationError("Enter a valid hostname.") from error

    if len(hostname) > 253 or not all(
        _hostname_label.fullmatch(label) for label in hostname.split(".")
    ):
        raise ValidationError("Enter a valid hostname.")

    try:
        ip_address(hostname)
    except ValueError:
        pass
    else:
        raise ValidationError("Enter a subdomain, not an IP address.")

    domain = _extract_domain(hostname, include_psl_private_domains=True)
    if not domain.suffix or not domain.domain or not domain.subdomain:
        raise ValidationError("Enter an exact subdomain, not an apex domain.")

    return hostname


class InvalidManagedIngestDomainStateTransition(ValueError):
    pass


@cell_silo_model
class ManagedIngestDomain(DefaultFieldsModel):
    class Provider(models.TextChoices):
        CLOUDFLARE = "cloudflare", "Cloudflare"
        FAKE = "fake", "Fake"

    class Status(models.TextChoices):
        CREATING = "creating", "Creating"
        PENDING_DNS = "pending_dns", "Pending DNS"
        PENDING_CERTIFICATE = "pending_certificate", "Pending certificate"
        ACTIVE = "active", "Active"
        ERROR = "error", "Error"
        DELETING = "deleting", "Deleting"

    # Provider resources cannot be safely copied by organization relocation. A production design
    # needs explicit hostname-to-cell ownership and lifecycle handling before this can be exported.
    __relocation_scope__ = RelocationScope.Excluded

    project = models.OneToOneField(
        "sentry.Project", on_delete=models.CASCADE, related_name="managed_ingest_domain"
    )
    hostname = models.CharField(max_length=253, unique=True)
    provider = models.CharField(max_length=32, choices=Provider.choices)
    provider_hostname_id = models.CharField(max_length=128, null=True)
    cname_target = models.CharField(max_length=253, null=True)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.CREATING)
    provider_status = models.CharField(max_length=64, null=True)
    certificate_status = models.CharField(max_length=64, null=True)
    verification_errors = models.JSONField(default=list)
    last_error = models.TextField(null=True)
    last_checked_at = models.DateTimeField(null=True)
    activated_at = models.DateTimeField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_managedingestdomain"

    __repr__ = sane_repr("project_id", "hostname", "status")

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.hostname = normalize_hostname(self.hostname)
        super().save(*args, **kwargs)

    def transition_to(self, status: Status) -> None:
        current = self.Status(self.status)
        if status != current and status not in _ALLOWED_STATUS_TRANSITIONS[current]:
            raise InvalidManagedIngestDomainStateTransition(f"{current} -> {status}")

        self.status = status
        if status == self.Status.ACTIVE and self.activated_at is None:
            self.activated_at = timezone.now()


_ALLOWED_STATUS_TRANSITIONS = {
    ManagedIngestDomain.Status.CREATING: frozenset(
        {
            ManagedIngestDomain.Status.PENDING_DNS,
            ManagedIngestDomain.Status.PENDING_CERTIFICATE,
            ManagedIngestDomain.Status.ACTIVE,
            ManagedIngestDomain.Status.ERROR,
            ManagedIngestDomain.Status.DELETING,
        }
    ),
    ManagedIngestDomain.Status.PENDING_DNS: frozenset(
        {
            ManagedIngestDomain.Status.PENDING_CERTIFICATE,
            ManagedIngestDomain.Status.ACTIVE,
            ManagedIngestDomain.Status.ERROR,
            ManagedIngestDomain.Status.DELETING,
        }
    ),
    ManagedIngestDomain.Status.PENDING_CERTIFICATE: frozenset(
        {
            ManagedIngestDomain.Status.PENDING_DNS,
            ManagedIngestDomain.Status.ACTIVE,
            ManagedIngestDomain.Status.ERROR,
            ManagedIngestDomain.Status.DELETING,
        }
    ),
    ManagedIngestDomain.Status.ACTIVE: frozenset(
        {ManagedIngestDomain.Status.ERROR, ManagedIngestDomain.Status.DELETING}
    ),
    ManagedIngestDomain.Status.ERROR: frozenset(
        {
            ManagedIngestDomain.Status.PENDING_DNS,
            ManagedIngestDomain.Status.PENDING_CERTIFICATE,
            ManagedIngestDomain.Status.ACTIVE,
            ManagedIngestDomain.Status.DELETING,
        }
    ),
    ManagedIngestDomain.Status.DELETING: frozenset(),
}
