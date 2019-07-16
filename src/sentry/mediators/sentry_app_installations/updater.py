from __future__ import absolute_import

import six


# from sentry import analytics
from sentry.constants import SentryAppInstallationStatus
from sentry.mediators import Mediator, Param
from sentry.mediators.param import if_param


class Updater(Mediator):
    sentry_app_installation = Param('sentry.models.SentryAppInstallation')
    status = Param(six.string_types, required=False)

    def call(self):
        self._update_status()
        self.sentry_app_installation.save()
        return self.sentry_app_installation

    @if_param('status')
    def _update_status(self):
        # convert from string to integer
        self.sentry_app_installation.status = SentryAppInstallationStatus.STATUS_MAP[self.status]

    def record_analytics(self):
        pass
        # TODO: Add analytics
        # analytics.record(
        #     'sentry_app_installation.updated',
        #     user_id=self.user.id,
        #     sentry_app_installation=self.sentry_app_installation.id,
        # )
