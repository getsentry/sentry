import httpx

from sentry.testutils.helpers.apigateway import ApiGatewayTestCase, verify_request_body
from sentry.testutils.silo import no_silo_test
from sentry.utils import json


@no_silo_test(cells=[ApiGatewayTestCase.CELL])
class VerifyRequestBodyTest(ApiGatewayTestCase):
    def test_verify_request_body(self) -> None:
        body = {"ab": "cd"}
        headers = {"header": "nope", "content-type": "application/json"}
        callback = verify_request_body(body, headers)

        mock_request = httpx.Request(
            "POST",
            "http://ab.cd.e/test",
            headers=headers,
            content=json.dumps(body).encode("utf8"),
        )
        status_code, resp_headers, resp_body = callback(mock_request)
        assert status_code == 200
