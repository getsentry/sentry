from __future__ import absolute_import

import os
from openapi_core import create_spec
from sentry.utils import json
from sentry.testutils import APITestCase


class APIDocsTestCase(APITestCase):
    def create_schema(self):
        spec = None
        # get the generated json file
        path = os.path.join(os.path.dirname(__file__)) + "/openapi-derefed.json"
        with open(path) as json_file:
            data = json.load(json_file)
            # remove DSN and update server to testserver
            spec = create_spec(data)
            print(spec)

        json_file.close()
        return spec

    def validate_schema(self, response):
        # TODO(meredith): Use validators to validate
        pass
