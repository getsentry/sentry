from __future__ import absolute_import

import logging

from django.db import models, IntegrityError
from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField,
    EncryptedJsonField,
    FlexibleForeignKey,
    Model,
    DefaultFieldsModel,
)
from sentry.signals import integration_added


logger = logging.getLogger(__name__)


class PagerDutyService(DefaultFieldsModel):
    __core__ = False

    organization_integration = FlexibleForeignKey("sentry.OrganizationIntegration")
    integration_key = models.CharField(max_length=255)
    service_name = models.CharField(max_length=255)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pagerdutyservice"


class IntegrationExternalProject(DefaultFieldsModel):
    __core__ = False

    organization_integration_id = BoundedPositiveIntegerField(db_index=True)
    date_added = models.DateTimeField(default=timezone.now)
    name = models.CharField(max_length=128)
    external_id = models.CharField(max_length=64)
    resolved_status = models.CharField(max_length=64)
    unresolved_status = models.CharField(max_length=64)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_integrationexternalproject"
        unique_together = (("organization_integration_id", "external_id"),)


class OrganizationIntegration(DefaultFieldsModel):
    __core__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    integration = FlexibleForeignKey("sentry.Integration")
    config = EncryptedJsonField(default=dict)

    default_auth_id = BoundedPositiveIntegerField(db_index=True, null=True)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE, choices=ObjectStatus.as_choices()
    )

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationintegration"
        unique_together = (("organization", "integration"),)


# TODO(epurkhiser): This is deprecated and will be removed soon. Do not use
# Project Integrations.
class ProjectIntegration(Model):
    __core__ = False

    project = FlexibleForeignKey("sentry.Project")
    integration = FlexibleForeignKey("sentry.Integration")
    config = EncryptedJsonField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectintegration"
        unique_together = (("project", "integration"),)


class Integration(DefaultFieldsModel):
    __core__ = False

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

    class Meta:
        app_label = "sentry"
        db_table = "sentry_integration"
        unique_together = (("provider", "external_id"),)

    def get_provider(self):
        from sentry import integrations

        return integrations.get(self.provider)

    def get_installation(self, organization_id, **kwargs):
        return self.get_provider().get_installation(self, organization_id, **kwargs)

    def has_feature(self, feature):
        return feature in self.get_provider().features

    def add_organization(self, organization, user=None, default_auth_id=None):
        """
        Add an organization to this integration.

        Returns False if the OrganizationIntegration was not created
        """
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

    def reauthorize(self, data):
        """
        The structure of `data` depends on the `build_integration`
        method on the integration provider.

        Each provider may have their own way of reauthorizing the
        integration.
        """
        if self.provider == "slack":
            metadata = data.get("metadata", {})
            metadata["old_access_token"] = self.metadata["access_token"]
            self.update(metadata=metadata)
