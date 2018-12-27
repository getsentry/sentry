from __future__ import absolute_import

import six
import uuid

from django.db import models
from django.utils import timezone

from sentry.db.models import (FlexibleForeignKey, ParanoidModel)


class SentryAppInstallation(ParanoidModel):
    __core__ = True

    sentry_app = FlexibleForeignKey('sentry.SentryApp',
                                    related_name='installations')

    # SentryApp's are installed and scoped to an Organization. They will have
    # access, defined by their scopes, to Teams, Projects, etc. under that
    # Organization, implicitly.
    organization = FlexibleForeignKey('sentry.Organization',
                                      related_name='sentry_app_installations')

    # Each installation gets associated with an instance of ApiAuthorization.
    authorization = models.OneToOneField(
        'sentry.ApiAuthorization',
        null=True,
        on_delete=models.SET_NULL,
        related_name='sentry_app_installation',
    )

    # Each installation has a Grant that the integration can exchange for an
    # Access Token.
    api_grant = models.OneToOneField('sentry.ApiGrant',
                                     null=True,
                                     on_delete=models.SET_NULL,
                                     related_name='sentry_app_installation')

    uuid = models.CharField(max_length=64,
                            default=lambda: six.binary_type(uuid.uuid4()))

    date_added = models.DateTimeField(default=timezone.now)
    date_updated = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_sentryappinstallation'
