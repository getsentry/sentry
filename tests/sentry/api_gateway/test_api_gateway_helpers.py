import requests
import responses

from sentry.testutils.helpers.api_gateway import ApiGatewayTestCase, verify_request_body


class VerifyRequestBodyTest(ApiGatewayTestCase):
    @responses.activate
    def test_verify_request_body(self):
        body = {"ab": "cd"}
        headers = {"header": "nope"}
        responses.add_callback(
            responses.POST, "http://ab.cd.e/test", verify_request_body(body, headers)
        )
        resp = requests.post("http://ab.cd.e/test", json=body, headers=headers)
        assert resp.status_code == 200
