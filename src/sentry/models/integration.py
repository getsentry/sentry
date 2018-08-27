from __future__ import absolute_import

from django.db import models, IntegrityError, transaction
from django.utils import timezone

from sentry import analytics
from sentry.constants import ObjectStatus
from sentry.db.models import (
    BoundedPositiveIntegerField, EncryptedJsonField, FlexibleForeignKey, Model
)


class IntegrationExternalProject(Model):
    __core__ = False

    organization_integration_id = BoundedPositiveIntegerField(db_index=True)
    date_added = models.DateTimeField(default=timezone.now)
    name = models.CharField(max_length=128)
    external_id = models.CharField(max_length=64)
    resolved_status = models.CharField(max_length=64)
    unresolved_status = models.CharField(max_length=64)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_integrationexternalproject'
        unique_together = (('organization_integration_id', 'external_id'),)


class OrganizationIntegration(Model):
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    integration = FlexibleForeignKey('sentry.Integration')
    config = EncryptedJsonField(default=lambda: {})

    default_auth_id = BoundedPositiveIntegerField(db_index=True, null=True)
    date_added = models.DateTimeField(default=timezone.now, null=True)
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE,
        choices=ObjectStatus.as_choices(),
    )

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationintegration'
        unique_together = (('organization', 'integration'),)


# TODO(epurkhiser): This is deprecated and will be removed soon. Do not use
# Project Integrations.
class ProjectIntegration(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    integration = FlexibleForeignKey('sentry.Integration')
    config = EncryptedJsonField(default=lambda: {})

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_projectintegration'
        unique_together = (('project', 'integration'),)


class Integration(Model):
    __core__ = False

    organizations = models.ManyToManyField('sentry.Organization',
                                           related_name='integrations',
                                           through=OrganizationIntegration)
    projects = models.ManyToManyField('sentry.Project',
                                      related_name='integrations',
                                      through=ProjectIntegration)
    provider = models.CharField(max_length=64)
    external_id = models.CharField(max_length=64)
    name = models.CharField(max_length=200)
    # metadata might be used to store things like credentials, but it should NOT
    # be used to store organization-specific information, as the Integration
    # instance is shared among multiple organizations
    metadata = EncryptedJsonField(default=lambda: {})
    status = BoundedPositiveIntegerField(
        default=ObjectStatus.VISIBLE,
        choices=ObjectStatus.as_choices(),
        null=True,
    )
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_integration'
        unique_together = (('provider', 'external_id'),)

    def get_provider(self):
        from sentry import integrations
        return integrations.get(self.provider)

    def get_installation(self, organization_id, **kwargs):
        return self.get_provider().get_installation(self, organization_id, **kwargs)

    def has_feature(self, feature):
        return feature in self.get_provider().features

    def add_organization(self, organization_id, default_auth_id=None, config=None):
        """
        Add an organization to this integration.

        Returns False if the OrganizationIntegration was not created
        """
        try:
            with transaction.atomic():
                return OrganizationIntegration.objects.create(
                    organization_id=organization_id,
                    integration_id=self.id,
                    default_auth_id=default_auth_id,
                    config=config or {},
                )
        except IntegrityError:
            return False
        else:
            analytics.record(
                'integration.added',
                provider=self.provider,
                id=self.id,
                organization_id=organization_id,
            )
