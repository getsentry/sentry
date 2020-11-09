from __future__ import absolute_import

import six

from sentry.coreapi import APIUnauthorized
from sentry.mediators import Mediator, Param, external_requests
from sentry.models import PlatformExternalIssue
from sentry.utils.cache import memoize
from sentry.utils.html import escape


class IssueLinkCreator(Mediator):
    install = Param("sentry.models.SentryAppInstallation")
    group = Param("sentry.models.Group")
    action = Param(six.string_types)
    fields = Param(object)
    uri = Param(six.string_types)
    user = Param("sentry.models.User")

    def call(self):
        self._verify_action()
        self._make_external_request()
        self._create_external_issue()
        return self.external_issue

    def _verify_action(self):
        if self.action not in ["link", "create"]:
            raise APIUnauthorized(u"Invalid action '{}'".format(self.action))

    def _make_external_request(self):
        self.response = external_requests.IssueLinkRequester.run(
            install=self.install,
            uri=self.uri,
            group=self.group,
            fields=self.fields,
            user=self.user,
            action=self.action,
        )

    def _format_response_data(self):
        web_url = self.response["webUrl"]

        display_name = u"{}#{}".format(
            escape(self.response["project"]), escape(self.response["identifier"])
        )

        return [web_url, display_name]

    def _create_external_issue(self):
        web_url, display_name = self._format_response_data()
        self.external_issue = PlatformExternalIssue.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            service_type=self.sentry_app.slug,
            display_name=display_name,
            web_url=web_url,
        )

    @memoize
    def sentry_app(self):
        return self.install.sentry_app
