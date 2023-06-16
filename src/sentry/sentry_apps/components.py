from __future__ import annotations

import dataclasses
from typing import Any, List, Mapping, MutableMapping
from urllib.parse import urlparse, urlunparse

from django.db import transaction
from django.utils.encoding import force_str
from django.utils.http import urlencode

from sentry.mediators.external_requests import SelectRequester
from sentry.models import SentryAppComponent, SentryAppInstallation
from sentry.services.hybrid_cloud.app.serial import serialize_sentry_app_installation
from sentry.utils import json


@dataclasses.dataclass
class SentryAppComponentPreparer:
    component: SentryAppComponent
    install: SentryAppInstallation
    project_slug: str | None = None
    values: List[Mapping[str, Any]] = dataclasses.field(default_factory=list)

    def run(self) -> None:
        with transaction.atomic():
            if self.component.type == "issue-link":
                self._prepare_issue_link()
            elif self.component.type == "stacktrace-link":
                self._prepare_stacktrace_link()
            elif self.component.type == "alert-rule-action":
                self._prepare_alert_rule_action()

    def _prepare_stacktrace_link(self) -> None:
        schema = self.component.schema
        uri = schema.get("uri")

        urlparts = list(urlparse(force_str(self.install.sentry_app.webhook_url)))
        urlparts[2] = uri

        query = {"installationId": self.install.uuid}

        if self.project_slug:
            query["projectSlug"] = self.project_slug

        urlparts[4] = urlencode(query)
        schema.update({"url": urlunparse(urlparts)})

    def _prepare_issue_link(self) -> None:
        schema = self.component.schema.copy()

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
        schema = self.component.schema.copy()
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
        install = serialize_sentry_app_installation(self.install, self.install.sentry_app)
        return SelectRequester.run(
            install=install,
            project_slug=self.project_slug,
            uri=uri,
            dependent_data=dependent_data,
        )
