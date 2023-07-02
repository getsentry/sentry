from datetime import timedelta

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, control_silo_only_model
from sentry.utils import jwt as jwt_utils

DEFAULT_EXPIRATION = timedelta(minutes=10)


def default_expiration():
    return timezone.now() + DEFAULT_EXPIRATION


@control_silo_only_model
class OpenIDToken(Model):
    """
    ID Token for a specific user issued as a result of user authentication.
    Compliant with the OpenID Connect Core 1.0 spec
    """

    __include_in_export__ = False

    user = FlexibleForeignKey("sentry.User")

    iss = models.CharField(max_length=64, default="https://sentry.io")
    aud = models.CharField(max_length=64)
    exp = models.DateTimeField(db_index=True, default=default_expiration)
    iat = models.DateTimeField(default=timezone.now)
    nonce = models.CharField(max_length=64, null=True)

    def get_encrypted_id_token(self):
        headers = {
            "alg": "HS256",
            "typ": "JWT",
        }
        claims = {
            "iss": self.iss,
            "sub": self.user.id,
            "aud": self.aud,
            "exp": self.exp,
            "iat": self.iat,
        }
        if self.nonce:
            claims["nonce"] = self.nonce
        return jwt_utils.encode(claims, "secret", headers={**headers, "alg": "HS256"})
