from typing import int
from datetime import datetime, timedelta

from django.utils import timezone

TOKEN_LIFE_IN_HOURS = 8

SENSITIVE_CHARACTER_LIMIT = 4

AUTHORIZATION = "authorization_code"
REFRESH = "refresh_token"
CLIENT_SECRET_JWT = "urn:sentry:params:oauth:grant-type:jwt-bearer"


class GrantTypes:
    AUTHORIZATION = AUTHORIZATION
    REFRESH = REFRESH
    CLIENT_SECRET_JWT = CLIENT_SECRET_JWT


def token_expiration() -> datetime:
    return timezone.now() + timedelta(hours=TOKEN_LIFE_IN_HOURS)
