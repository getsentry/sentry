from io import BytesIO

import requests
import responses

from sentry.testutils.helpers.apigateway import ApiGatewayTestCase, verify_request_body
from sentry.testutils.silo import no_silo_test
from sentry.utils import json


@no_silo_test(regions=[ApiGatewayTestCase.REGION])
class VerifyRequestBodyTest(ApiGatewayTestCase):
    @responses.activate
    def test_verify_request_body(self):
        body = {"ab": "cd"}
        headers = {"header": "nope", "content-type": "application/json"}
        responses.add_callback(
            responses.POST, "http://ab.cd.e/test", verify_request_body(body, headers)
        )
        resp = requests.post(
            "http://ab.cd.e/test", data=BytesIO(json.dumps(body).encode("utf8")), headers=headers
        )
        assert resp.status_code == 200
