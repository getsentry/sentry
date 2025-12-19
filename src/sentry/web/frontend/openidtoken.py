from datetime import timedelta
from typing import Protocol

from django.utils import timezone

from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail
from sentry.utils import jwt as jwt_utils

DEFAULT_EXPIRATION = timedelta(minutes=10)


def default_expiration():
    return timezone.now() + DEFAULT_EXPIRATION


class GrantLike(Protocol):
    """Protocol for objects that can be used to generate OpenID tokens.

    This allows both ApiGrant objects and grant-like objects (e.g., those
    reconstructed after the grant has been deleted) to be used.
    """

    user: User

    def has_scope(self, scope: str) -> bool: ...


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

    def get_signed_id_token(self, grant: GrantLike) -> str:
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
        user_details = self._get_user_details(grant=grant)
        claims.update(user_details)
        if self.nonce:
            claims["nonce"] = self.nonce
        return jwt_utils.encode(claims, self.shared_secret, headers={**headers, "alg": "HS256"})

    def _get_user_details(self, grant: GrantLike) -> dict:
        user_details = {}
        if grant.has_scope("profile"):
            profile_details = {
                "name": grant.user.name,
                "avatar_type": grant.user.avatar_type,
                "avatar_url": grant.user.avatar_url,
                "date_joined": str(grant.user.date_joined),
            }
            user_details.update(profile_details)
        if grant.has_scope("email"):
            for user_email in UserEmail.objects.filter(user=grant.user):
                if user_email.is_primary():
                    email_details = {
                        "email": user_email.email,
                        "email_verified": user_email.is_verified,
                    }
                    user_details.update(email_details)
        return user_details
