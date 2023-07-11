from datetime import timedelta

from django.utils import timezone

from sentry.utils import jwt as jwt_utils

DEFAULT_EXPIRATION = timedelta(minutes=10)


def default_expiration():
    return timezone.now() + DEFAULT_EXPIRATION


class OpenIDToken:
    """
    ID Token for a specific user issued as a result of user authentication.
    Compliant with the OpenID Connect Core 1.0 spec
    """

    def __init__(
        self,
        aud,
        sub,
        shared_secret,
        iss="https://sentry.io",
        exp=None,
        iat=None,
        nonce=None,
    ):
        self.shared_secret = shared_secret
        self.aud = aud
        self.sub = sub
        self.iss = iss
        self.nonce = nonce
        self.exp = exp if exp else default_expiration()
        self.iat = iat if iat else timezone.now()

    def get_encrypted_id_token(self):
        headers = {
            "alg": "HS256",
            "typ": "JWT",
        }
        claims = {
            "iss": self.iss,
            "sub": self.sub,
            "aud": self.aud,
            "exp": self.exp,
            "iat": self.iat,
        }
        if self.nonce:
            claims["nonce"] = self.nonce
        return jwt_utils.encode(claims, self.shared_secret, headers={**headers, "alg": "HS256"})
