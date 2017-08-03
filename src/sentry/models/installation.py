from __future__ import absolute_import

from django.db import models

from sentry.db.models import Model, FlexibleForeignKey


class OrganizationInstallation(Model):
    __core__ = False

    organization = FlexibleForeignKey('sentry.Organization')
    installation = FlexibleForeignKey('sentry.Installation')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationinstallation'
        unique_together = (('organization', 'installation'),)


class Installation(Model):
    __core__ = False

    organizations = models.ManyToManyField('sentry.Organization',
                                           related_name='installations',
                                           through=OrganizationInstallation)
    provider = models.CharField(max_length=64)
    # TODO(jess) maybe this is not necessary bc it's our integration
    # id and therefore the same for all (across a provider)
    app_id = models.CharField(max_length=64)
    installation_id = models.CharField(max_length=64, unique=True)
    external_organization = models.CharField(max_length=64, null=True)
    external_id = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_installation'
