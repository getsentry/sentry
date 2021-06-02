"""Common handling of JWT tokens.

This is an attempt to have all the interactions with JWT in once place, so that we have once
central place which handles JWT in a uniform way.
"""

from typing import List, Mapping, Optional, Union

import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey
from jwt import DecodeError

__all__ = ["peek_claims", "decode", "encode", "authorization_header", "DecodeError"]


def get_unverified_header(token):
    """
    Just delegating to jwt
    """
    return pyjwt.get_unverified_header(token)


def peek_claims(token: str) -> Mapping[str, str]:
    """Returns the claims (payload) in the JWT token without validation.

    These claims can be used to look up the correct key to use in :func:`decode`.
    """
    return pyjwt.decode(token, verify=False)


def decode(
    token: str,
    key: bytes,
    *,
    audience: Union[None, str, bool] = None,
    algorithms: Optional[List[str]] = None,
) -> Mapping[str, str]:
    """Returns the claims (payload) in the JWT token.

    This will raise an exception if the claims can not be validated with the provided key.

    :param audience: Set this to the audience you expect to be present in the claims.  Set
       this to ``False`` to disable verifying the audience.
    """
    options = dict()
    kwargs = dict()
    if audience is False:
        options["verify_aud"] = False
    elif audience is True:
        raise ValueError("audience can not be True")
    elif audience is not None:
        kwargs["audience"] = audience
    return pyjwt.decode(token, key, options=options, algorithms=algorithms, **kwargs)


def encode(
    payload: Mapping[str, str],
    key: bytes,
    *,
    algorithm: str = "HS256",
    headers: Optional[Mapping[str, str]] = None,
) -> str:
    """Encode a JWT token containing the provided payload/claims.

    The encoded claims are signed with the provided key using the HS256 algorithm.
    """
    if headers is None:
        headers = {}
    return pyjwt.encode(payload, key, algorithm=algorithm, headers=headers).decode("UTF-8")


def authorization_header(token: str, *, scheme: str = "Bearer") -> Mapping[str, str]:
    """Returns an authorization header for the given token.

    The returned header can be used with ``requests``, if you already have any headers in a
    dictionary you can use ``headers.update(authorization_header(...))`` to add the
    authorization header.

    Typically JWT uses the token in the "Bearer" scheme for the authorisation header.  If
    you need to use a differnt scheme use the `scheme` argument to change this.
    """
    return {"Authorization": f"{scheme} {token}"}


def rsa_key_from_jwk(jwk: str) -> Union[RSAPrivateKey, RSAPublicKey]:
    """Returns an RSA key from a serialised JWK.

    This constructs an RSA key from a JSON Web Key, the result can be used as key to
    :func:`encode`.
    """
    return pyjwt.algorithms.RSAAlgorithm.from_jwk(jwk)
