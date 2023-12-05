from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, ClassVar, List

from django.db import IntegrityError, models, router, transaction

from sentry.backup.scopes import RelocationScope
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    DefaultFieldsModel,
    control_silo_only_model,
)
from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.manager import BaseManager
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.outbox import ControlOutbox, OutboxCategory, OutboxScope, outbox_context
from sentry.services.hybrid_cloud.organization import RpcOrganization, organization_service
from sentry.signals import integration_added
from sentry.types.region import find_regions_for_orgs

if TYPE_CHECKING:
    from sentry.integrations import (
        IntegrationFeatures,
        IntegrationInstallation,
        IntegrationProvider,
    )

logger = logging.getLogger(__name__)


class IntegrationManager(BaseManager["Integration"]):
    def get_active_integrations(self, organization_id: str):
        return self.filter(
            status=ObjectStatus.ACTIVE,
            organizationintegration__status=ObjectStatus.ACTIVE,
            organizationintegration__organization_id=organization_id,
        )


@control_silo_only_model
class Integration(DefaultFieldsModel):
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
    metadata = JSONField(default=dict)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.ACTIVE, choices=ObjectStatus.as_choices(), null=True
    )

    objects: ClassVar[IntegrationManager] = IntegrationManager()

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
    def outboxes_for_update(identifier: int) -> List[ControlOutbox]:
        org_ids: List[int] = OrganizationIntegration.objects.filter(
            integration_id=identifier
        ).values_list("organization_id", flat=True)
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
        self, organization_id: int | RpcOrganization, user=None, default_auth_id=None
    ):
        """
        Add an organization to this integration.

        Returns False if the OrganizationIntegration was not created
        """
        from sentry.models.integrations.organization_integration import OrganizationIntegration

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
            return False

    def disable(self):
        """
        Disable this integration
        """

        self.update(status=ObjectStatus.DISABLED)
        self.save()
