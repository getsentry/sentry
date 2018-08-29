from __future__ import absolute_import

import six
import uuid

from django.db import models
from django.utils import timezone
from django.template.defaultfilters import slugify

from sentry.db.models import FlexibleForeignKey, ParanoidModel
from sentry.models.apiscopes import HasApiScopes


class SentryApp(ParanoidModel, HasApiScopes):
    __core__ = True

    application = models.OneToOneField('sentry.ApiApplication',
                                       related_name='sentry_app')

    # Much of the OAuth system in place currently depends on a User existing.
    # This "proxy user" represents the SentryApp in those cases.
    proxy_user = models.OneToOneField('sentry.User',
                                      related_name='sentry_app')

    # The owner is an actual Sentry User who created the SentryApp. Used to
    # determine who can manage the SentryApp itself.
    owner = FlexibleForeignKey('sentry.User',
                               related_name='owned_sentry_apps')

    name = models.TextField()
    slug = models.CharField(max_length=64, unique=True)
    uuid = models.CharField(max_length=64,
                            default=lambda: six.binary_type(uuid.uuid4()))

    webhook_url = models.TextField()

    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_sentryapp'

    def save(self, *args, **kwargs):
        self._set_slug()
        return super(SentryApp, self).save(*args, **kwargs)

    def _set_slug(self):
        """
        Matches ``name``, but in lowercase, dash form.

        >>> self._set_slug('My Cool App')
        >>> self.slug
        my-cool-app
        """
        if not self.slug:
            self.slug = slugify(self.name)
