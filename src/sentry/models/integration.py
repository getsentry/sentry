from __future__ import absolute_import

from django.db import models, IntegrityError, transaction
from jsonfield import JSONField

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model


class OrganizationIntegration(Model):
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    integration = FlexibleForeignKey('sentry.Integration')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationintegration'
        unique_together = (('organization', 'integration'),)


class ProjectIntegration(Model):
    __core__ = False

    project = FlexibleForeignKey('sentry.Project')
    integration = FlexibleForeignKey('sentry.Integration')
    config = JSONField(default=lambda: {})

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
    config = JSONField(default=lambda: {})
    name = models.CharField(max_length=200)
    default_auth_id = BoundedPositiveIntegerField(db_index=True, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_integration'
        unique_together = (('provider', 'external_id'),)

    def add_organization(self, organization_id):
        """
        Add an organization to this integration.

        Returns True if the OrganizationIntegration was created
        """
        try:
            with transaction.atomic():
                OrganizationIntegration.objects.create(
                    organization_id=organization_id,
                    integration_id=self.id,
                )
        except IntegrityError:
            return False
        else:
            return True
