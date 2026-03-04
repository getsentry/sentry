# API Gateway Test Reference

## Import Block

```python
from urllib.parse import urlencode

import pytest
import responses
from django.test import override_settings
from django.urls import reverse

from sentry.silo.base import SiloLimit, SiloMode
from sentry.testutils.helpers.apigateway import (
    ApiGatewayTestCase,
    verify_request_params,
    verify_request_body,
    verify_request_headers,
    verify_file_body,
)
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
```

## Template: Standard API Gateway Test

```python
@control_silo_test(regions=[ApiGatewayTestCase.REGION], include_monolith_run=True)
class Test{Feature}ApiGateway(ApiGatewayTestCase):

    @responses.activate
    def test_proxy_get_with_params(self):
        """Verify GET request is proxied with query parameters intact."""
        query_params = dict(foo="test", bar=["one", "two"])
        headers = dict(example="this")
        responses.add_callback(
            responses.GET,
            f"{self.REGION.address}/organizations/{self.organization.slug}/{endpoint_path}/",
            verify_request_params(query_params, headers),
        )

        base_url = reverse(
            "{url-name}",
            kwargs={"organization_slug": self.organization.slug},
        )
        encoded_params = urlencode(query_params, doseq=True)
        url = f"{base_url}?{encoded_params}"

        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(url, headers=headers)
        assert resp.status_code == 200, resp.content

    @responses.activate
    def test_proxy_post_with_body(self):
        """Verify POST request is proxied with body intact."""
        request_body = {"key": "value", "nested": {"a": 1}}
        headers = {"content-type": "application/json"}
        responses.add_callback(
            responses.POST,
            f"{self.REGION.address}/organizations/{self.organization.slug}/{endpoint_path}/",
            verify_request_body(request_body, headers),
        )

        url = reverse(
            "{url-name}",
            kwargs={"organization_slug": self.organization.slug},
        )
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.post(
                url,
                data=json.dumps(request_body),
                content_type="application/json",
                headers=headers,
            )
        assert resp.status_code == 200, resp.content

    @responses.activate
    def test_proxy_error_forwarded(self):
        """Verify upstream errors are forwarded to the client."""
        responses.add(
            responses.GET,
            f"{self.REGION.address}/organizations/{self.organization.slug}/{endpoint_path}/",
            status=400,
            json={"detail": "Bad request"},
        )

        url = reverse(
            "{url-name}",
            kwargs={"organization_slug": self.organization.slug},
        )
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(url)
        assert resp.status_code == 400
```

## Template: Reading Proxied Response Content

In CONTROL mode, proxied responses are streamed. Use `close_streaming_response()` to read the body:

```python
    @responses.activate
    def test_proxy_response_content(self):
        """Verify proxied response content is correct."""
        responses.add_callback(
            responses.GET,
            f"{self.REGION.address}/organizations/{self.organization.slug}/{endpoint_path}/",
            verify_request_params({}, {}),
        )

        url = reverse(
            "{url-name}",
            kwargs={"organization_slug": self.organization.slug},
        )
        with override_settings(MIDDLEWARE=tuple(self.middleware)):
            resp = self.client.get(url)
        assert resp.status_code == 200

        # In CONTROL mode, responses are streamed
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            resp_json = json.loads(resp.content)
            assert resp_json["proxy"] is False
        else:
            resp_json = json.loads(close_streaming_response(resp))
            assert resp_json["proxy"] is True
```

## Template: SiloLimit Availability Check

```python
    def test_control_only_endpoint_unavailable_in_region(self):
        """Verify control-only endpoints raise AvailabilityError outside their silo."""
        with pytest.raises(SiloLimit.AvailabilityError):
            self.client.get("/api/0/{control-only-path}/")
```

## Key Patterns

- **`ApiGatewayTestCase`** sets up a test region, mock HTTP callbacks, and the API gateway middleware. It extends `APITestCase`.
- **`@control_silo_test(regions=[...], include_monolith_run=True)`** runs the test in both CONTROL and MONOLITH modes.
- **Every test method MUST use `@responses.activate`** because gateway tests mock HTTP calls to the region address.
- **`verify_request_params(params, headers)`** is a callback that asserts query params and headers match.
- **`verify_request_body(body, headers)`** asserts POST body matches.
- **`close_streaming_response(resp)`** reads a streaming response to bytes — required for proxied responses in CONTROL mode.
- **`override_settings(MIDDLEWARE=tuple(self.middleware))`** ensures the API gateway middleware is active.
- **`self.REGION`** is a pre-configured `Region` object with address `http://us.internal.sentry.io`.
- **`self.organization`** is pre-created in `setUp` and bound to `self.REGION`.
