from django.db import router

from sentry.coreapi import APIError
from sentry.mediators.external_requests.alert_rule_action_requester import (
    AlertRuleActionRequester,
    AlertRuleActionResult,
)
from sentry.mediators.mediator import Mediator
from sentry.mediators.param import Param
from sentry.models.integrations.sentry_app_component import SentryAppComponent
from sentry.models.integrations.sentry_app_installation import SentryAppInstallation
from sentry.utils.cache import memoize


class AlertRuleActionCreator(Mediator):
    using = router.db_for_write(SentryAppComponent)
    install = Param(SentryAppInstallation)
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

        self.response = AlertRuleActionRequester.run(
            install=self.install,
            uri=uri,
            fields=self.fields,
        )

    @memoize
    def sentry_app(self):
        return self.install.sentry_app
