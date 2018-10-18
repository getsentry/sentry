from __future__ import absolute_import

import six
import uuid

from django.db import models
from django.utils import timezone
from django.template.defaultfilters import slugify

from sentry.constants import SentryAppStatus
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, ParanoidModel
from sentry.models import Organization
from sentry.models.apiscopes import HasApiScopes


def default_uuid():
    return six.binary_type(uuid.uuid4())


class SentryApp(ParanoidModel, HasApiScopes):
    __core__ = True

    application = models.OneToOneField(
        'sentry.ApiApplication',
        null=True,
        on_delete=models.SET_NULL,
        related_name='sentry_app',
    )

    # Much of the OAuth system in place currently depends on a User existing.
    # This "proxy user" represents the SentryApp in those cases.
    proxy_user = models.OneToOneField(
        'sentry.User',
        null=True,
        on_delete=models.SET_NULL,
        related_name='sentry_app'
    )

    # The Organization the Sentry App was created in "owns" it. Members of that
    # Org have differing access, dependent on their role within the Org.
    owner = FlexibleForeignKey('sentry.Organization',
                               related_name='owned_sentry_apps')

    name = models.TextField()
    slug = models.CharField(max_length=64, unique=True)
    status = BoundedPositiveIntegerField(
        default=SentryAppStatus.UNPUBLISHED,
        choices=SentryAppStatus.as_choices(),
        db_index=True,
    )
    uuid = models.CharField(max_length=64,
                            default=default_uuid)

    webhook_url = models.TextField()

    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_sentryapp'

    @property
    def organizations(self):
        if not self.pk:
            return Organization.objects.none()

        return Organization \
            .objects \
            .select_related('sentry_app_installations') \
            .filter(sentry_app_installations__sentry_app_id=self.id)

    @property
    def teams(self):
        from sentry.models import Team

        if not self.pk:
            return Team.objects.none()

        return Team.objects.filter(organization__in=self.organizations)

    def save(self, *args, **kwargs):
        self._set_slug()
        return super(SentryApp, self).save(*args, **kwargs)

    def is_installed_on(self, organization):
        return self.organizations.filter(pk=organization.pk).exists()

    def _set_slug(self):
        """
        Matches ``name``, but in lowercase, dash form.

        >>> self._set_slug('My Cool App')
        >>> self.slug
        my-cool-app
        """
        if not self.slug:
            self.slug = slugify(self.name)
