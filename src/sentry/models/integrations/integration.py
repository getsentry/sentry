from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, List

from django.db import IntegrityError, models, transaction

from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    DefaultFieldsModel,
    control_silo_only_model,
)
from sentry.db.models.fields.jsonfield import JSONField
from sentry.db.models.manager import BaseManager
from sentry.db.postgres.roles import in_test_psql_role_override
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.outbox import ControlOutbox, OutboxCategory, OutboxScope
from sentry.signals import integration_added
from sentry.types.region import find_regions_for_orgs

if TYPE_CHECKING:
    from sentry.integrations import IntegrationInstallation, IntegrationProvider

logger = logging.getLogger(__name__)


class IntegrationManager(BaseManager):
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

    __include_in_export__ = False

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

    objects = IntegrationManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_integration"
        unique_together = (("provider", "external_id"),)

    def get_provider(self) -> IntegrationProvider:
        from sentry import integrations

        return integrations.get(self.provider)

    def delete(self, *args, **kwds):
        with transaction.atomic(), in_test_psql_role_override("postgres"):
            for organization_integration in self.organizationintegration_set.all():
                organization_integration.delete()
            for outbox in Integration.outboxes_for_update(self.id):
                outbox.save()
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

    def get_installation(self, organization_id: int, **kwargs: Any) -> IntegrationInstallation:
        return self.get_provider().get_installation(self, organization_id, **kwargs)

    def has_feature(self, feature):
        return feature in self.get_provider().features

    def add_organization(self, organization, user=None, default_auth_id=None):
        """
        Add an organization to this integration.

        Returns False if the OrganizationIntegration was not created
        """
        from sentry.models import OrganizationIntegration

        try:
            org_integration, created = OrganizationIntegration.objects.get_or_create(
                organization_id=organization.id,
                integration_id=self.id,
                defaults={"default_auth_id": default_auth_id, "config": {}},
            )
            # TODO(Steve): add audit log if created
            if not created and default_auth_id:
                org_integration.update(default_auth_id=default_auth_id)
        except IntegrityError:
            logger.info(
                "add-organization-integrity-error",
                extra={
                    "organization_id": organization.id,
                    "integration_id": self.id,
                    "default_auth_id": default_auth_id,
                },
            )
            return False
        else:
            integration_added.send_robust(
                integration=self, organization=organization, user=user, sender=self.__class__
            )

            return org_integration
