from datetime import datetime, timedelta

from django.utils import timezone

TOKEN_LIFE_IN_HOURS = 8

SENSITIVE_CHARACTER_LIMIT = 4

AUTHORIZATION = "authorization_code"
REFRESH = "refresh_token"
CLIENT_SECRET_JWT = "urn:sentry:params:oauth:grant-type:jwt-bearer"
DEVICE_CODE = "urn:ietf:params:oauth:grant-type:device_code"
# RFC 7523 - JWT Bearer Grant (used for ID-JAG)
JWT_BEARER = "urn:ietf:params:oauth:grant-type:jwt-bearer"


class GrantTypes:
    AUTHORIZATION = AUTHORIZATION
    REFRESH = REFRESH
    CLIENT_SECRET_JWT = CLIENT_SECRET_JWT
    DEVICE_CODE = DEVICE_CODE
    JWT_BEARER = JWT_BEARER


def token_expiration() -> datetime:
    return timezone.now() + timedelta(hours=TOKEN_LIFE_IN_HOURS)
