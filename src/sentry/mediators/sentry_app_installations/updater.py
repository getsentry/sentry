from __future__ import absolute_import

import six

from collections import Iterable

from sentry import analytics
from sentry.coreapi import APIError
from sentry.constants import SentryAppStatus
from sentry.mediators import Mediator, Param
from sentry.mediators import service_hooks
from sentry.mediators.param import if_param
from sentry.models import SentryAppComponent, ServiceHook
from sentry.models.sentryapp import REQUIRED_EVENT_PERMISSIONS


class Updater(Mediator):
    sentry_app_installation= Param('sentry.models.SentryAppInstallation')
    status = Param(six.string_types, required=False)

    def call(self):
        self._update_status()
        self.sentry_app_installation.save()
        return self.sentry_app_installation

    @if_param('status')
    def _update_status(self):
        print ("new status", self.status)
        self.sentry_app_installation.status = self.status

    def record_analytics(self):
        pass
        # TODO: Add analytics?
        # analytics.record(
        #     'sentry_app_installation.updated',
        #     user_id=self.user.id,
        #     sentry_app_installation=self.sentry_app_installation.id,
        # )
