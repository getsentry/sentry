from __future__ import absolute_import

from six.moves.urllib.parse import urlparse, urlencode, urlunparse
from sentry.mediators import Mediator, Param
from sentry.mediators.external_requests import SelectRequester


class Preparer(Mediator):
    component = Param("sentry.models.SentryAppComponent")
    install = Param("sentry.models.SentryAppInstallation")
    project = Param("sentry.models.Project")

    def call(self):
        if self.component.type == "issue-link":
            return self._prepare_issue_link()
        if self.component.type == "stacktrace-link":
            return self._prepare_stacktrace_link()

    def _prepare_stacktrace_link(self):
        schema = self.component.schema
        uri = schema.get("uri")

        urlparts = list(urlparse(self.install.sentry_app.webhook_url))
        urlparts[2] = uri

        query = {"installationId": self.install.uuid}

        if self.project:
            query["projectSlug"] = self.project.slug

        urlparts[4] = urlencode(query)
        schema.update({"url": urlunparse(urlparts)})

    def _prepare_issue_link(self):
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

    def _prepare_field(self, field):
        if "options" in field:
            field.update({"choices": field["options"]})

        if "uri" in field:
            if not field.get("skip_load_on_open"):
                field.update(self._request(field["uri"]))

    def _request(self, uri):
        return SelectRequester.run(install=self.install, project=self.project, uri=uri)
