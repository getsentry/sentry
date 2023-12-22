import functools
import os

from django.conf import settings
from openapi_core.contrib.django import DjangoOpenAPIRequest, DjangoOpenAPIResponse
from openapi_core.spec import Spec
from openapi_core.validation.response.validators import V30ResponseDataValidator

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.skips import requires_snuba
from sentry.utils import json


@requires_snuba
class APIDocsTestCase(APITestCase):
    @functools.cached_property
    def cached_schema(self):
        path = os.path.join(os.path.dirname(__file__), "../tests/apidocs/openapi-derefed.json")
        with open(path) as json_file:
            data = json.load(json_file)
            data["servers"][0]["url"] = settings.SENTRY_OPTIONS["system.url-prefix"]
            del data["components"]

            return Spec.from_dict(data)

    def validate_schema(self, request, response):
        assert 200 <= response.status_code < 300, response.status_code

        if isinstance(response.data, list):
            assert len(response.data) > 0, "Cannot validate an empty list"

        response["Content-Type"] = "application/json"
        V30ResponseDataValidator(self.cached_schema).validate(
            DjangoOpenAPIRequest(request), DjangoOpenAPIResponse(response)
        )

    def create_event(self, name, **kwargs):
        # Somewhat sane default data.
        data = {
            "event_id": (name * 32)[:32],
            "fingerprint": ["1"],
            "sdk": {"version": "5.17.0", "name": "sentry.javascript.browser"},
            "timestamp": iso_format(before_now(seconds=1)),
            "user": {"id": self.user.id, "email": self.user.email},
            "release": name,
        }
        data.update(kwargs)

        return self.store_event(data=data, project_id=self.project.id)
