from __future__ import absolute_import

from django.db import models
from django.utils import timezone

from sentry.db.models import BoundedPositiveIntegerField, EncryptedJsonField, FlexibleForeignKey, Model


class Feature(object):
    API = 0
    ISSUE_LINK = 1
    STACKTRACE_LINK = 2
    EVENT_HOOKS = 3

    @classmethod
    def as_choices(cls):
        return (
            (cls.API, 'integrations-api'),
            (cls.ISSUE_LINK, 'integrations-issue-link'),
            (cls.STACKTRACE_LINK, 'integrations-stacktrace-link'),
            (cls.EVENT_HOOKS, 'integrations-event-hooks'),
        )

    @classmethod
    def as_str(cls, feature):
        if feature == cls.API:
            return 'integrations-api'
        elif feature == cls.ISSUE_LINK:
            return 'integrations-issue-link'
        elif feature == cls.STACKTRACE_LINK:
            return 'integrations-stacktrace-link'
        elif feature == cls.EVENT_HOOKS:
            return 'integrations-event-hooks'


class IntegrationFeature(Model):
    __core__ = False

    description = EncryptedJsonField(default=dict)
    feature = BoundedPositiveIntegerField(
        default=0,
        choices=Feature.as_choices(),
    )
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_integrationfeature'

    def feature_str(self):
        return Feature.as_str(self.feature)


class SentryAppIntegrationFeature(Model):
    __core__ = False

    feature = FlexibleForeignKey('sentry.IntegrationFeature')
    sentry_app = FlexibleForeignKey('sentry.SentryApp')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_sentryappintegrationfeature'
