from __future__ import absolute_import

import six
import uuid

from django.db import models
from django.utils import timezone

from sentry.constants import SentryAppInstallationStatus
from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, ParanoidModel, Model


def default_uuid():
    return six.binary_type(uuid.uuid4())


class SentryAppInstallationToken(Model):
    __core__ = False

    api_token = FlexibleForeignKey("sentry.ApiToken")
    sentry_app_installation = FlexibleForeignKey("sentry.SentryAppInstallation")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappinstallationtoken"
        unique_together = (("sentry_app_installation", "api_token"),)


class SentryAppInstallation(ParanoidModel):
    __core__ = True

    sentry_app = FlexibleForeignKey("sentry.SentryApp", related_name="installations")

    # SentryApp's are installed and scoped to an Organization. They will have
    # access, defined by their scopes, to Teams, Projects, etc. under that
    # Organization, implicitly.
    organization = FlexibleForeignKey(
        "sentry.Organization", related_name="sentry_app_installations"
    )

    # Each installation has a Grant that the integration can exchange for an
    # Access Token.
    api_grant = models.OneToOneField(
        "sentry.ApiGrant",
        null=True,
        on_delete=models.SET_NULL,
        related_name="sentry_app_installation",
    )

    # Two scenarios for tokens:
    # 1) An installation gets an access token once the Grant has been exchanged,
    # and is updated when the token gets refreshed.
    #
    # 2) An installation is created for an internal SentryApp. This token will
    # not need to be refreshed as it will live forever
    api_token = models.OneToOneField(
        "sentry.ApiToken",
        null=True,
        on_delete=models.SET_NULL,
        related_name="sentry_app_installation",
    )

    uuid = models.CharField(max_length=64, default=default_uuid)

    status = BoundedPositiveIntegerField(
        default=SentryAppInstallationStatus.PENDING,
        choices=SentryAppInstallationStatus.as_choices(),
        db_index=True,
    )

    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappinstallation"

    # Used when first creating an Installation to tell the serializer that the
    # grant code should be included in the serialization.
    is_new = False

    def save(self, *args, **kwargs):
        self.date_updated = timezone.now()
        return super(SentryAppInstallation, self).save(*args, **kwargs)
