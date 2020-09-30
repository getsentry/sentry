from __future__ import absolute_import

import os

from django.conf import settings
from openapi_core import create_spec
from openapi_core.contrib.django import DjangoOpenAPIRequest, DjangoOpenAPIResponse
from openapi_core.validation.response.validators import ResponseValidator

from sentry.utils import json
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class APIDocsTestCase(APITestCase):
    def create_schema(self):
        path = os.path.join(os.path.dirname(__file__), "openapi-derefed.json")
        with open(path, "r") as json_file:
            data = json.load(json_file)
            data["servers"][0]["url"] = settings.SENTRY_OPTIONS["system.url-prefix"]
            del data["components"]

            return create_spec(data)

    def validate_schema(self, request, response):
        assert 200 <= response.status_code < 300, response.status_code

        response["Content-Type"] = "application/json"
        result = ResponseValidator(self.create_schema()).validate(
            DjangoOpenAPIRequest(request), DjangoOpenAPIResponse(response)
        )

        result.raise_for_errors()
        assert result.errors == []

    def create_event(self, name, **kwargs):
        # Somewhat sane default data.
        data = {
            "event_id": (name * 32)[:32],
            "fingerprint": ["1"],
            "sdk": {"version": "5.17.0", "name": "sentry.javascript.browser"},
            "timestamp": iso_format(before_now(seconds=1)),
            "user": {"id": 1, "email": self.user.email},
        }
        data.update(kwargs)

        return self.store_event(data=data, project_id=self.project.id)
