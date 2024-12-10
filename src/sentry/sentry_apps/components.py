from __future__ import annotations

import dataclasses
from collections.abc import Mapping, MutableMapping
from typing import Any
from urllib.parse import urlparse, urlunparse

from django.utils.encoding import force_str
from django.utils.http import urlencode

from sentry.sentry_apps.external_requests.select_requester import SelectRequester
from sentry.sentry_apps.models.sentry_app_component import SentryAppComponent
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app.model import RpcSentryAppComponent, RpcSentryAppInstallation
from sentry.sentry_apps.services.app.serial import serialize_sentry_app_installation
from sentry.utils import json


@dataclasses.dataclass
class SentryAppComponentPreparer:
    component: SentryAppComponent | RpcSentryAppComponent
    install: SentryAppInstallation | RpcSentryAppInstallation
    project_slug: str | None = None
    values: list[Mapping[str, Any]] = dataclasses.field(default_factory=list)

    def run(self) -> None:
        if self.component.type == "issue-link":
            self._prepare_issue_link()
        elif self.component.type == "stacktrace-link":
            self._prepare_stacktrace_link()
        elif self.component.type == "alert-rule-action":
            self._prepare_alert_rule_action()

    def _prepare_stacktrace_link(self) -> None:
        schema = self.component.app_schema
        uri = schema.get("uri")

        urlparts = list(urlparse(force_str(self.install.sentry_app.webhook_url)))
        urlparts[2] = str(uri)

        query = {"installationId": self.install.uuid}

        if self.project_slug:
            query["projectSlug"] = self.project_slug

        urlparts[4] = urlencode(query)
        schema.update({"url": urlunparse(urlparts)})

    def _prepare_issue_link(self) -> None:
        schema = dict(**self.component.app_schema)

        link = schema.get("link", {})
        create = schema.get("create", {})

        for field in link.get("required_fields", []):
            self._prepare_field(field)

        for field in link.get("optional_fields", []):
            self._prepare_field(field)

        for field in create.get("required_fields", []):
            self._prepare_field(field)

        for field in create.get("optional_fields", []):
            self._prepare_field(field)

    def _prepare_alert_rule_action(self) -> None:
        schema = dict(**self.component.app_schema)
        settings = schema.get("settings", {})

        for field in settings.get("required_fields", []):
            self._prepare_field(field)

        for field in settings.get("optional_fields", []):
            self._prepare_field(field)

    def _prepare_field(self, field: MutableMapping[str, Any]) -> None:
        if "depends_on" in field:
            dependant_data_list = list(
                filter(lambda val: val["name"] in field.get("depends_on", {}), self.values)
            )
            if len(dependant_data_list) != len(field.get("depends_on", {})):
                field.update({"choices": []})
                return

            dependant_data = json.dumps({x["name"]: x["value"] for x in dependant_data_list})

            self._get_select_choices(field, dependant_data)
            return

        self._get_select_choices(field)

    def _get_select_choices(
        self, field: MutableMapping[str, Any], dependant_data: str | None = None
    ) -> None:
        if "options" in field:
            field.update({"choices": field["options"]})
            return

        if "uri" in field:
            if not field.get("skip_load_on_open"):
                field.update(self._request(field["uri"], dependent_data=dependant_data))

    def _request(self, uri: str, dependent_data: str | None = None) -> Any:
        install = self.install
        if isinstance(install, SentryAppInstallation):
            install = serialize_sentry_app_installation(install, install.sentry_app)
        return SelectRequester(
            install=install,
            project_slug=self.project_slug,
            uri=uri,
            dependent_data=dependent_data,
        ).run()
