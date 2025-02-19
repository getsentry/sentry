from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from django.db import IntegrityError, models, router, transaction

from sentry.backup.dependencies import NormalizedModelName, get_model_name
from sentry.backup.sanitize import SanitizableField, Sanitizer
from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    DefaultFieldsModelExisting,
    control_silo_model,
)
from sentry.db.models.fields.jsonfield import JSONField
from sentry.hybridcloud.models.outbox import ControlOutbox, outbox_context
from sentry.hybridcloud.outbox.category import OutboxCategory, OutboxScope
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.signals import integration_added
from sentry.types.region import find_regions_for_orgs

if TYPE_CHECKING:
    from sentry.integrations.base import (
        IntegrationFeatures,
        IntegrationInstallation,
        IntegrationProvider,
    )
    from sentry.models.organization import Organization
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser

logger = logging.getLogger(__name__)


@control_silo_model
class Integration(DefaultFieldsModelExisting):
    """
    An integration tied to a particular instance of a third-party provider (a single Slack
    workspace, a single GH org, etc.), which can be shared by multiple Sentry orgs.
    """

    __relocation_scope__ = RelocationScope.Global

    provider = models.CharField(max_length=64)
    external_id = models.CharField(max_length=64)
    name = models.CharField(max_length=200)
    # metadata might be used to store things like credentials, but it should NOT
    # be used to store organization-specific information, as an Integration
    # instance can be shared by multiple organizations
    metadata: models.Field[dict[str, Any], dict[str, Any]] = JSONField(default=dict)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices(), null=True
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_integration"
        unique_together = (("provider", "external_id"),)

    def get_provider(self) -> IntegrationProvider:
        from .utils import get_provider

        return get_provider(instance=self)

    def get_installation(self, organization_id: int, **kwargs: Any) -> IntegrationInstallation:
        from .utils import get_installation

        return get_installation(instance=self, organization_id=organization_id, **kwargs)

    def has_feature(self, feature: IntegrationFeatures) -> bool:
        from .utils import has_feature

        return has_feature(instance=self, feature=feature)

    def delete(self, *args, **kwds):
        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationIntegration)), flush=False
        ):
            for outbox in Integration.outboxes_for_update(self.id):
                outbox.save()
            for organization_integration in self.organizationintegration_set.all():
                organization_integration.delete()
            return super().delete(*args, **kwds)

    @staticmethod
    def outboxes_for_update(identifier: int) -> list[ControlOutbox]:
        org_ids = OrganizationIntegration.objects.filter(integration_id=identifier).values_list(
            "organization_id", flat=True
        )
        return [
            ControlOutbox(
                shard_scope=OutboxScope.INTEGRATION_SCOPE,
                shard_identifier=identifier,
                object_identifier=identifier,
                category=OutboxCategory.INTEGRATION_UPDATE,
                region_name=region_name,
            )
            for region_name in find_regions_for_orgs(org_ids)
        ]

    def add_organization(
        self,
        organization_id: int | Organization | RpcOrganization,
        user: User | RpcUser | None = None,
        default_auth_id: int | None = None,
    ) -> OrganizationIntegration | None:
        """
        Add an organization to this integration.

        Returns None if the OrganizationIntegration was not created
        """
        from sentry.integrations.models.organization_integration import OrganizationIntegration

        if not isinstance(organization_id, int):
            organization_id = organization_id.id

        try:
            with transaction.atomic(using=router.db_for_write(OrganizationIntegration)):
                org_integration, created = OrganizationIntegration.objects.get_or_create(
                    organization_id=organization_id,
                    integration_id=self.id,
                    defaults={"default_auth_id": default_auth_id, "config": {}},
                )
                # TODO(Steve): add audit log if created
                if not created and default_auth_id:
                    org_integration.update(default_auth_id=default_auth_id)

                if created:
                    organization_service.schedule_signal(
                        integration_added,
                        organization_id=organization_id,
                        args=dict(integration_id=self.id, user_id=user.id if user else None),
                    )
                return org_integration
        except IntegrityError:
            logger.info(
                "add-organization-integrity-error",
                extra={
                    "organization_id": organization_id,
                    "integration_id": self.id,
                    "default_auth_id": default_auth_id,
                },
            )
            return None

    def disable(self):
        """
        Disable this integration
        """

        self.update(status=ObjectStatus.DISABLED)
        self.save()

    @classmethod
    def sanitize_relocation_json(
        cls, json: Any, sanitizer: Sanitizer, model_name: NormalizedModelName | None = None
    ) -> None:
        model_name = get_model_name(cls) if model_name is None else model_name
        super().sanitize_relocation_json(json, sanitizer, model_name)

        sanitizer.set_string(json, SanitizableField(model_name, "external_id"))
        sanitizer.set_json(json, SanitizableField(model_name, "metadata"), {})
        sanitizer.set_string(json, SanitizableField(model_name, "provider"))
