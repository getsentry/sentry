import logging
from typing import Any, Sequence

from django.db import IntegrityError, models

from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField, DefaultFieldsModel, EncryptedJsonField
from sentry.db.models.manager import BaseManager
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.models.integrations.project_integration import ProjectIntegration
from sentry.signals import integration_added

logger = logging.getLogger(__name__)


class IntegrationManager(BaseManager):
    def get_active_integrations(self, organization_id: str):
        return self.filter(
            status=ObjectStatus.ACTIVE,
            organizationintegration__status=ObjectStatus.ACTIVE,
            organizationintegration__organization_id=organization_id,
        )


class Integration(DefaultFieldsModel):
    __include_in_export__ = False

    organizations = models.ManyToManyField(
        "sentry.Organization", related_name="integrations", through=OrganizationIntegration
    )
    projects = models.ManyToManyField(
        "sentry.Project", related_name="integrations", through=ProjectIntegration
    )
    provider = models.CharField(max_length=64)
    external_id = models.CharField(max_length=64)
    name = models.CharField(max_length=200)
    # metadata might be used to store things like credentials, but it should NOT
    # be used to store organization-specific information, as the Integration
    # instance is shared among multiple organizations
    metadata = EncryptedJsonField(default=dict)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE, choices=ObjectStatus.as_choices(), null=True
    )

    objects = IntegrationManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_integration"
        unique_together = (("provider", "external_id"),)

    def get_provider(self):
        from sentry import integrations

        return integrations.get(self.provider)

    def get_installation(self, organization_id: int, **kwargs: Any) -> Any:
        return self.get_provider().get_installation(self, organization_id, **kwargs)

    def get_installations(self, **kwargs: Any) -> Sequence[Any]:
        return [
            self.get_provider().get_installation(self, organization.id, **kwargs)
            for organization in self.organizations.all()
        ]

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
