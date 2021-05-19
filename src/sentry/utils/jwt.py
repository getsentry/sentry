"""Common handling of JWT tokens.

This is an attempt to have all the interactions with JWT in once place, so that we have once
central place which handles JWT in a uniform way.
"""

from typing import Mapping, Union

import jwt
from jwt import DecodeError

__all__ = ["peek_claims", "decode", "encode", "authorization_header", "DecodeError"]


def peek_claims(token: str) -> Mapping[str, str]:
    """Returns the claims (payload) in the JWT token without validation.

    These claims can be used to look up the correct key to use in :func:`decode`.
    """
    return jwt.decode(token, verify=False)


def decode(token: str, key: bytes, verify_aud: bool = True) -> Mapping[str, str]:
    """Returns the claims (payload) in the JWT token.

    This will raise an exception if the claims can not be validated with the provided key.

    :param verify_aud: By default if the claims in the token contain an audience ("aud")
       then we would have to provide the audience at decode time to verify it matches.  If
       your claims include an audience claim you can use this to ignore it.
    """
    options = dict()
    if not verify_aud:
        options["verify_aud"] = False
    return jwt.decode(token, key, options=options)


def encode(
    payload: Mapping[str, str],
    key: bytes,
    *,
    algorithm: str = "HS256",
    headers: Union[Mapping[str, str], None] = None,
) -> str:
    """Encode a JWT token containing the provided payload/claims.

    The encoded claims are signed with the provided key using the HS256 algorithm.
    """
    if headers is None:
        headers = {}
    return jwt.encode(payload, key, algorithm=algorithm, headers=headers).decode("UTF-8")


def authorization_header(token: str, *, scheme: str = "Bearer") -> Mapping[str, str]:
    """Returns an authorization header for the given token.

    The returned header can be used with ``requests``, if you already have any headers in a
    dictionary you can use ``headers.update(authorization_header(...))`` to add the
    authorization header.

    Typically JWT uses the token in the "Bearer" scheme for the authorisation header.  If
    you need to use a differnt scheme use the `scheme` argument to change this.
    """
    return {"Authorization": f"{scheme} {token}"}
