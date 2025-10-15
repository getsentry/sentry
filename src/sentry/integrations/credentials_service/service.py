from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from datetime import timedelta
from enum import StrEnum
from typing import Protocol

import orjson
from cryptography.fernet import Fernet
from django.conf import settings
from django.db.models import QuerySet

from sentry.constants import ObjectStatus
from sentry.integrations.credentials_service.types import (
    CredentialLeasable,
    CredentialLease,
    InvalidCredentialLeaseTarget,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.silo.base import control_silo_function

logger = logging.getLogger(__name__)


@dataclass
class LeasedCredentials:
    access_token: str
    permissions: dict[str, str] | None
    expires_at: str | None
    lease_duration_seconds: int
    sentry_organization_id: str
    external_installation_id: str
    resource_identifier: str
    resource_type: str
    integration_provider: str


class ResourceType(StrEnum):
    ORGANIZATION = "organization"
    # PROVIDER_INSTALLATION = "provider_installation"
    SENTRY_INSTALLATION = "sentry_installation"


class CredentialLeaseProtocol(Protocol):
    def get_maximum_lease_duration_seconds(self) -> int: ...

    def refresh_access_token_with_minimum_validity_time(
        self, token_minimum_validity_time: timedelta
    ) -> None: ...


# TODO(Gabe): Fix these inane comments
class ScmIntegrationCredentialsService:
    @control_silo_function
    def get_credentials_by_resource(
        self,
        sentry_organization_id: int,
        integration_provider: str,
        token_minimum_validity_seconds: int,
        resource_type: ResourceType,
        resource_identifier: str,
    ) -> str:
        """Get credentials for a resource, refreshing if necessary based on minimum validity time."""
        integration = self._get_integration_by_resource(
            sentry_organization_id=sentry_organization_id,
            integration_provider=integration_provider,
            resource_type=resource_type,
            resource_identifier=resource_identifier,
        )

        leased_credentials = self._get_credentials_from_integration(
            integration=integration,
            sentry_organization_id=sentry_organization_id,
            resource_type=resource_type,
            resource_identifier=resource_identifier,
            token_minimum_validity_seconds=token_minimum_validity_seconds,
        )

        return self._encrypt_credentials(leased_credentials)

    @control_silo_function
    def rotate_credentials_by_resource(
        self,
        sentry_organization_id: int,
        integration_provider: str,
        resource_type: ResourceType,
        resource_identifier: str,
    ) -> str:
        """Force refresh credentials for a resource, regardless of expiry time."""
        integration = self._get_integration_by_resource(
            sentry_organization_id=sentry_organization_id,
            integration_provider=integration_provider,
            resource_type=resource_type,
            resource_identifier=resource_identifier,
        )

        leased_credentials = self._get_credentials_from_integration(
            integration=integration,
            sentry_organization_id=sentry_organization_id,
            resource_type=resource_type,
            resource_identifier=resource_identifier,
            force_refresh=True,
        )

        return self._encrypt_credentials(leased_credentials)

    def _get_integration_by_resource(
        self,
        sentry_organization_id: int,
        integration_provider: str,
        resource_type: ResourceType,
        resource_identifier: str,
    ) -> Integration:
        """
        Retrieves an integration by the given combination of sentry organization
        and resource. This method should perform validation that an _active_
        OrganizationIntegration exists prior to returning the parent integration.
        This validates that the organization has a valid installation.
        """
        installation_query = self._get_installation_query_for_organization(sentry_organization_id)
        if resource_type == ResourceType.ORGANIZATION:
            installation_query = installation_query.filter(
                integration__provider=integration_provider,
                status=ObjectStatus.ACTIVE,
                integration__name=resource_identifier,
            )

            if installation_query.count() < 1:
                raise OrganizationIntegration.DoesNotExist(
                    f"Integration {resource_identifier} has no installation"
                )

            if installation_query.count() > 1:
                raise OrganizationIntegration.MultipleObjectsReturned(
                    f"Integration {resource_identifier} has multiple installations with the same name"
                )

            org_integration = installation_query.first()
            assert org_integration is not None

            return org_integration.integration

        elif resource_type == ResourceType.SENTRY_INSTALLATION:
            installation = installation_query.filter(
                id=resource_identifier,
            ).get()
            return installation.integration

        # Superfluous for now, but enforces that new resource types have
        # explicit handling.
        raise ValueError(f"Unsupported resource_type: {resource_type}")

    def _get_installation_query_for_organization(
        self, sentry_organization_id: int
    ) -> QuerySet[OrganizationIntegration]:
        integrations = OrganizationIntegration.objects.filter(
            organization_id=sentry_organization_id,
            status=ObjectStatus.ACTIVE,
        ).prefetch_related("integration")

        return integrations

    def _get_credentials_from_integration(
        self,
        integration: Integration,
        sentry_organization_id: int,
        resource_type: ResourceType,
        resource_identifier: str,
        token_minimum_validity_seconds: int = 10,
        force_refresh: bool = False,
    ) -> LeasedCredentials:
        """Extract or refresh credentials from integration."""

        installation = integration.get_installation(organization_id=sentry_organization_id)

        if not isinstance(installation, CredentialLeasable):
            raise InvalidCredentialLeaseTarget("Integration does not support credential leasing")

        if installation.get_maximum_lease_duration_seconds() < token_minimum_validity_seconds:
            raise ValueError(
                "Token minimum validity time is greater than the maximum lease duration for the provider"
            )

        credential_lease: CredentialLease | None = None
        if force_refresh:
            credential_lease = installation.force_refresh_access_token()
        elif installation.does_access_token_expire_within(
            token_minimum_validity_time=timedelta(seconds=token_minimum_validity_seconds)
        ):
            credential_lease = installation.refresh_access_token_with_minimum_validity_time(
                token_minimum_validity_time=timedelta(seconds=token_minimum_validity_seconds)
            )
        else:
            credential_lease = installation.get_active_access_token()

        return LeasedCredentials(
            access_token=credential_lease.access_token,
            permissions=credential_lease.permissions,
            expires_at=(
                credential_lease.expires_at.isoformat() if credential_lease.expires_at else None
            ),
            lease_duration_seconds=token_minimum_validity_seconds,
            sentry_organization_id=str(sentry_organization_id),
            external_installation_id=integration.external_id,
            resource_identifier=resource_identifier,
            resource_type=resource_type.value,
            integration_provider=integration.provider,
        )

    def _encrypt_credentials(self, credentials: LeasedCredentials) -> str:
        """Encrypt LeasedCredentials using Fernet."""
        try:
            key = self._get_fernet_key_for_encryption()
            f = Fernet(key)
        except Exception:
            logger.exception("sentry.credentials_service.invalid_fernet_key")
            raise

        credentials_json = orjson.dumps(asdict(credentials))
        encrypted_data = f.encrypt(credentials_json)

        return encrypted_data.decode("utf-8")

    def _get_fernet_key_for_encryption(self) -> bytes:
        key = settings.INTEGRATION_CREDENTIALS_LEASE_ENCRYPTION_KEY
        if not key:
            raise ValueError("INTEGRATION_CREDENTIALS_LEASE_ENCRYPTION_KEY is not set")
        return key.encode("utf-8")
