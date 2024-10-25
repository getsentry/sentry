from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import jwt as pyjwt
from django.http import HttpRequest
from jwt import InvalidTokenError

from sentry import options
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.jwt import peek_header

logger = logging.getLogger(__name__)


TOKEN_LIFETIME = timedelta(days=30)


def get_secret_key() -> str:
    # this is the same secret that is used for session cookies
    return options.get("system.secret-key")


def get_issuer() -> str:
    return options.get("system.base-hostname")


def get_jwt_token(
    user: User | RpcUser,
    organization: Organization,
    project: Project,
    expiration: datetime,
) -> str:
    algorithm = "HS256"
    return pyjwt.encode(
        payload={
            # For help with the names see: https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
            # Registered claim names are three characters long, and sentry
            # vspecific ones are shortend as JWT is meant to be compact.
            "exp": int(expiration.timestamp()),
            "iss": get_issuer(),
            "iat": int(datetime.now().timestamp()),
            "sub": user.id,
            "org": organization.id,
            "proj": project.id,
        },
        key=get_secret_key(),
        algorithm=algorithm,
        headers={"alg": algorithm, "typ": "JWT"},
    )


class UserJWTToken:
    @classmethod
    def from_request(cls, request: HttpRequest, context: dict[str, Any]):
        if not (request.user.is_authenticated and request.user.is_active):
            return None

        organization: Organization | None = context.get("organization")
        if not organization:
            return None

        project: Project | None = context.get("project")
        if not project:
            return None

        return get_jwt_token(request.user, organization, project, datetime.now() + TOKEN_LIFETIME)

    @classmethod
    def is_jwt(cls, token: str) -> bool:
        try:
            header = peek_header(token)
            return header.get("typ") == "JWT"
        except ValueError:
            raise InvalidTokenError("Invalid token")

    @classmethod
    def decode_verified_user(cls, token: str) -> int:
        try:
            header = pyjwt.get_unverified_header(token.encode("UTF-8"))
            body = pyjwt.decode(
                jwt=token,
                key=get_secret_key(),
                algorithms=[header.get("alg"), "HS256"],
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iss": True,
                },
                issuer=get_issuer(),
            )
            return int(body.get("sub"))
        except ValueError:
            raise InvalidTokenError("Invalid token")
