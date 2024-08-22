from datetime import timedelta

from django.utils import timezone

TOKEN_LIFE_IN_HOURS = 8

AUTHORIZATION = "authorization_code"
REFRESH = "refresh_token"
TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange"


class GrantTypes:
    AUTHORIZATION = AUTHORIZATION
    REFRESH = REFRESH
    TOKEN_EXCHANGE = TOKEN_EXCHANGE


def token_expiration():
    return timezone.now() + timedelta(hours=TOKEN_LIFE_IN_HOURS)
