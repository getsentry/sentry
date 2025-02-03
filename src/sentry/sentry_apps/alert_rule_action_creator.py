from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

from django.db import router, transaction
from django.utils.functional import cached_property

from sentry.sentry_apps.external_requests.alert_rule_action_requester import (
    SentryAppAlertRuleActionRequester,
    SentryAppAlertRuleActionResult,
)
from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.utils.errors import SentryAppErrorType


@dataclass
class SentryAppAlertRuleActionCreator:
    install: SentryAppInstallation
    fields: list[Mapping[str, Any]] = field(default_factory=list)

    def run(self) -> SentryAppAlertRuleActionResult:
        with transaction.atomic(router.db_for_write(SentryAppComponent)):
            uri = self._fetch_sentry_app_uri()
            response = self._make_external_request(uri)
            return response

    def _fetch_sentry_app_uri(self):
        component = SentryAppComponent.objects.get(
            type="alert-rule-action", sentry_app=self.sentry_app
        )
        settings = component.schema.get("settings", {})
        return settings.get("uri")

    def _make_external_request(self, uri=None):
        if uri is None:
            return SentryAppAlertRuleActionResult(
                message="Request url for alert-rule-action not found, please check your integration schema",
                success=False,
                error_type=SentryAppErrorType.INTEGRATOR,
                status_code=500,
            )
        response = SentryAppAlertRuleActionRequester(
            install=self.install,
            uri=uri,
            fields=self.fields,
        ).run()

        return response

    @cached_property
    def sentry_app(self):
        return self.install.sentry_app
