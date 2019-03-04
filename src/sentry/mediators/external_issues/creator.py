from __future__ import absolute_import

import six

from sentry.mediators import Mediator, Param
from sentry.models import PlatformExternalIssue
from sentry.utils.cache import memoize


class Creator(Mediator):
    install = Param('sentry.models.SentryAppInstallation')
    group = Param('sentry.models.Group')
    display_name = Param(six.string_types)
    web_url = Param(six.string_types)

    def call(self):
        self._create_external_issue()
        return self.external_issue

    def _create_external_issue(self):
        self.external_issue = PlatformExternalIssue.objects.create(
            group_id=self.group.id,
            service_type=self.sentry_app.slug,
            display_name=self.display_name,
            web_url=self.web_url,
        )

    @memoize
    def sentry_app(self):
        return self.install.sentry_app
