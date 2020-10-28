from __future__ import absolute_import

import six
import logging
from uuid import uuid4

from six.moves.urllib.parse import urlparse, urlencode, urlunparse
from sentry.http import safe_urlread
from sentry.coreapi import APIError
from sentry.mediators import Mediator, Param
from sentry.mediators.external_requests.util import validate, send_and_save_sentry_app_request
from sentry.utils import json
from sentry.utils.cache import memoize

logger = logging.getLogger("sentry.mediators.external-requests")


class SelectRequester(Mediator):
    """
    1. Makes a GET request to another service to fetch data needed to populate
    the SelectField dropdown in the UI.

    `installationId` and `project` are included in the params of the request

    2. Validates and formats the response.
    """

    install = Param("sentry.models.SentryAppInstallation")
    project = Param("sentry.models.Project", required=False)
    uri = Param(six.string_types)
    query = Param(six.string_types, required=False)
    dependent_data = Param(six.string_types, required=False)

    def call(self):
        return self._make_request()

    def _build_url(self):
        urlparts = list(urlparse(self.sentry_app.webhook_url))
        urlparts[2] = self.uri

        query = {"installationId": self.install.uuid}

        if self.project:
            query["projectSlug"] = self.project.slug

        if self.query:
            query["query"] = self.query

        if self.dependent_data:
            query["dependentData"] = self.dependent_data

        urlparts[4] = urlencode(query)
        return urlunparse(urlparts)

    def _make_request(self):
        try:
            body = safe_urlread(
                send_and_save_sentry_app_request(
                    self._build_url(),
                    self.sentry_app,
                    self.install.organization_id,
                    "select_options.requested",
                    headers=self._build_headers(),
                )
            )

            response = json.loads(body)
        except Exception as e:
            logger.info(
                "select-requester.error",
                extra={
                    "sentry_app": self.sentry_app.slug,
                    "install": self.install.uuid,
                    "project": self.project and self.project.slug,
                    "uri": self.uri,
                    "error_message": six.text_type(e),
                },
            )
            response = {}

        if not self._validate_response(response):
            raise APIError()

        return self._format_response(response)

    def _validate_response(self, resp):
        return validate(instance=resp, schema_type="select")

    def _format_response(self, resp):
        # the UI expects the following form:
        # choices: [[label, value]]
        # default: [label, value]
        response = {}
        choices = []

        for option in resp:
            choices.append([option["value"], option["label"]])
            if option.get("default"):
                response["defaultValue"] = option["value"]

        response["choices"] = choices
        return response

    def _build_headers(self):
        request_uuid = uuid4().hex

        return {
            "Content-Type": "application/json",
            "Request-ID": request_uuid,
            "Sentry-App-Signature": self.sentry_app.build_signature(""),
        }

    @memoize
    def sentry_app(self):
        return self.install.sentry_app
