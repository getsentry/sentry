from datetime import timedelta

from django.utils import timezone

TOKEN_LIFE_IN_HOURS = 8

AUTHORIZATION = "authorization_code"
REFRESH = "refresh_token"


class GrantTypes:
    AUTHORIZATION = AUTHORIZATION
    REFRESH = REFRESH


def token_expiration():
    return timezone.now() + timedelta(hours=TOKEN_LIFE_IN_HOURS)
