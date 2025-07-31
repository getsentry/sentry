from __future__ import annotations

from django.http.request import HttpRequest
from rest_framework.request import Request

from sentry.users.models.user import User


class _HttpRequestWithUser(HttpRequest):
    """typing-only: for use in TypeIs to narrow to non-AnonymousUser"""

    user: User


class _RequestWithUser(Request):
    """typing-only: for use in TypeIs to narrow to non-AnonymousUser"""

    user: User
