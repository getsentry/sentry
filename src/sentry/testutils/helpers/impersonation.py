from __future__ import annotations

from typing import Any
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser

from sentry.api.base import Endpoint
from sentry.users.models.user import User


def simulate_impersonation(impersonator: User | AnonymousUser) -> Any:
    """
    Context manager that patches Endpoint.initialize_request to set actual_user.

    Usage::

        with simulate_impersonation(impersonator_user):
            response = self.client.post(url, data={...})
        assert response.status_code == 403
    """
    original = Endpoint.initialize_request

    def patched(endpoint_self: Any, request: Any, *args: Any, **kwargs: Any) -> Any:
        drf_request = original(endpoint_self, request, *args, **kwargs)
        drf_request.actual_user = impersonator  # type: ignore[attr-defined]
        return drf_request

    return patch.object(Endpoint, "initialize_request", patched)
