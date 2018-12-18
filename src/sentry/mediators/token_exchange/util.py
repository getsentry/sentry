from __future__ import absolute_import

from datetime import datetime, timedelta


TOKEN_LIFE_IN_HOURS = 8

AUTHORIZATION = 'authorization_code'
REFRESH = 'refresh_token'


class GrantTypes(object):
    AUTHORIZATION = AUTHORIZATION
    REFRESH = REFRESH


def token_expiration():
    return (datetime.utcnow() + timedelta(hours=TOKEN_LIFE_IN_HOURS))
