from __future__ import absolute_import

from django.db import models, IntegrityError, transaction
from django.utils import timezone

from sentry.db.models import (
    BoundedPositiveIntegerField, EncryptedJsonField, FlexibleForeignKey, Model
)


class OrganizationIntegration(Model):
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    integration = FlexibleForeignKey('sentry.Integration')
    config = EncryptedJsonField(default=lambda: {})
    default_auth_id = BoundedPositiveIntegerField(db_index=True, null=True)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationintegration'
        unique_together = (('organization', 'integration'),)


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
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_integration'
        unique_together = (('provider', 'external_id'),)

    def get_provider(self):
        from sentry import integrations
        return integrations.get(self.provider)

    def add_organization(self, organization_id, default_auth_id=None, config=None):
        """
        Add an organization to this integration.

        Returns True if the OrganizationIntegration was created
        """
        try:
            with transaction.atomic():
                OrganizationIntegration.objects.create(
                    organization_id=organization_id,
                    integration_id=self.id,
                    default_auth_id=default_auth_id,
                    config=config or {},
                )
        except IntegrityError:
            return False
        else:
            return True
