from __future__ import absolute_import

import os

from django.conf import settings
from django.test.client import RequestFactory
from openapi_core import create_spec

from sentry.utils import json
from sentry.testutils import APITestCase


class APIDocsTestCase(APITestCase):
    def create_schema(self):
        path = os.path.join(os.path.dirname(__file__), "openapi-derefed.json")
        with open(path, "r") as json_file:
            data = json.load(json_file)
            data["servers"][0]["url"] = settings.SENTRY_OPTIONS["system.url-prefix"]
            del data["components"]

            return create_spec(data)

    def validate_schema(self, response):
        # TODO(meredith): Use validators to validate
        pass
