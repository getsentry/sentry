from __future__ import absolute_import

import six
import uuid
import hmac

from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.template.defaultfilters import slugify
from hashlib import sha256

from sentry.constants import SentryAppStatus, SENTRY_APP_SLUG_MAX_LENGTH
from sentry.models import Organization
from sentry.models.apiscopes import HasApiScopes
from sentry.db.models import (
    ArrayField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    ParanoidModel,
)

VALID_EVENTS = (
    'issue',
)

VALID_EVENT_PERMISSIONS = {
    'issue': 'event:read',
    'project': 'project:read',
    'member': 'member:read',
    'organization': 'org:read',
    'team': 'team:read',
}


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
    slug = models.CharField(max_length=SENTRY_APP_SLUG_MAX_LENGTH, unique=True)
    status = BoundedPositiveIntegerField(
        default=SentryAppStatus.UNPUBLISHED,
        choices=SentryAppStatus.as_choices(),
        db_index=True,
    )
    uuid = models.CharField(max_length=64,
                            default=default_uuid)

    redirect_url = models.URLField(null=True)
    webhook_url = models.URLField()
    # does the application subscribe to `event.alert`,
    # meaning can it be used in alert rules as a {service} ?
    is_alertable = models.BooleanField(default=False)

    events = ArrayField(of=models.TextField, null=True)

    overview = models.TextField(null=True)

    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_sentryapp'

    @classmethod
    def visible_for_user(cls, user):
        if user.is_superuser:
            return cls.objects.all()

        return cls.objects.filter(
            Q(status=SentryAppStatus.PUBLISHED) | Q(owner__in=user.get_orgs()),
        )

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

    @property
    def is_published(self):
        return self.status == SentryAppStatus.PUBLISHED

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

    def build_signature(self, body):
        secret = self.application.client_secret
        return hmac.new(
            key=secret.encode('utf-8'),
            msg=body.encode('utf-8'),
            digestmod=sha256,
        ).hexdigest()
