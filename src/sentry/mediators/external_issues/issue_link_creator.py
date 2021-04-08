from sentry.coreapi import APIUnauthorized
from sentry.mediators import Mediator, Param, external_issues, external_requests
from sentry.utils.cache import memoize


class IssueLinkCreator(Mediator):
    install = Param("sentry.models.SentryAppInstallation")
    group = Param("sentry.models.Group")
    action = Param((str,))
    fields = Param(object)
    uri = Param((str,))
    user = Param("sentry.models.User")

    def call(self):
        self._verify_action()
        self._make_external_request()
        self._create_external_issue()
        return self.external_issue

    def _verify_action(self):
        if self.action not in ["link", "create"]:
            raise APIUnauthorized(f"Invalid action '{self.action}'")

    def _make_external_request(self):
        self.response = external_requests.IssueLinkRequester.run(
            install=self.install,
            uri=self.uri,
            group=self.group,
            fields=self.fields,
            user=self.user,
            action=self.action,
        )

    def _create_external_issue(self):
        self.external_issue = external_issues.Creator.run(
            install=self.install,
            group=self.group,
            web_url=self.response["webUrl"],
            project=self.response["project"],
            identifier=self.response["identifier"],
        )

    @memoize
    def sentry_app(self):
        return self.install.sentry_app
