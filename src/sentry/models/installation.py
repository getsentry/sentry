from __future__ import absolute_import

from django.db import models, IntegrityError, transaction

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
    installation_id = models.CharField(max_length=64)
    external_organization = models.CharField(max_length=64)
    external_id = models.CharField(max_length=64)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_installation'
        unique_together = (('provider', 'installation_id'),)

    def add_organization(self, organization):
        """
        Add an organization to this installation.

        Returns True if the OrganizationInstallation was created
        """
        try:
            with transaction.atomic():
                OrganizationInstallation.objects.create(
                    organization=organization,
                    installation=self,
                )
        except IntegrityError:
            return False
        else:
            return True
