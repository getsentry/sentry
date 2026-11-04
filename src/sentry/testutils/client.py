from typing import Any

from rest_framework.test import APIClient


class SentryAPIClient(APIClient):
    """API test client that checks HTTP response contracts."""

    def request(self, **kwargs: Any) -> Any:
        response = super().request(**kwargs)
        if response.status_code == 204:
            # Django's test client removes 204 bodies but leaves their Content-Length.
            assert response.get("Content-Length", "0") == "0", (
                "204 responses must not include content"
            )
        return response
