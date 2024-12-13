from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from django.db import router, transaction
from django.utils.functional import cached_property

from sentry.coreapi import APIError
from sentry.sentry_apps.external_requests.alert_rule_action_requester import (
    AlertRuleActionRequester,
    AlertRuleActionResult,
)
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.utils.errors import SentryAppIntegratorError


@dataclass
class AlertRuleActionCreator:
    install: SentryAppInstallation
    fields: list[Mapping[str, Any]] = field(default_factory=list)

    def run(self) -> AlertRuleActionResult:
        with transaction.atomic(router.db_for_write(SentryAppComponent)):
            uri = self._fetch_sentry_app_uri()
            response = self._make_external_request(uri)
            return response

    def _fetch_sentry_app_uri(self) -> str:
        component = SentryAppComponent.objects.get(
            type="alert-rule-action", sentry_app=self.sentry_app
        )
        settings = component.schema.get("settings", {})
        uri = settings.get("uri", None)
        if not uri:
            raise SentryAppIntegratorError(APIError("Sentry App request url not found on schema"))
        return uri

    def _make_external_request(self, uri: str) -> AlertRuleActionResult:
        response = AlertRuleActionRequester(
            install=self.install,
            uri=uri,
            fields=self.fields,
        ).run()

        return response

    @cached_property
    def sentry_app(self) -> SentryApp:
        return self.install.sentry_app
