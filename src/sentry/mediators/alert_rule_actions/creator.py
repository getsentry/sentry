from sentry.coreapi import APIError
from sentry.mediators import Mediator, Param, external_requests
from sentry.mediators.external_requests.alert_rule_action_requester import AlertRuleActionResult
from sentry.models import SentryAppComponent
from sentry.utils.cache import memoize


class AlertRuleActionCreator(Mediator):
    install = Param("sentry.models.SentryAppInstallation")
    fields = Param(object, default=[])  # array of dicts

    def call(self) -> AlertRuleActionResult:
        uri = self._fetch_sentry_app_uri()
        self._make_external_request(uri)
        return self.response

    def _fetch_sentry_app_uri(self):
        component = SentryAppComponent.objects.get(
            type="alert-rule-action", sentry_app=self.sentry_app
        )
        settings = component.schema.get("settings", {})
        return settings.get("uri")

    def _make_external_request(self, uri=None):
        if uri is None:
            raise APIError("Sentry App request url not found")

        self.response = external_requests.AlertRuleActionRequester.run(
            install=self.install,
            uri=uri,
            fields=self.fields,
        )

    @memoize
    def sentry_app(self):
        return self.install.sentry_app
