"""Common handling of JWT tokens.

This is an attempt to have all the interactions with JWT in once place, so that we have once
central place which handles JWT in a uniform way.
"""

from typing import List, Mapping, Optional, Union

import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey, RSAPublicKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)
from jwt import DecodeError

__all__ = ["peek_claims", "decode", "encode", "authorization_header", "DecodeError"]


def peek_header(token: str) -> Mapping[str, str]:
    """Returns the headers in the JWT token without validation.

    Headers are not signed and can thus be spoofed.  You can use these to decide on what
    parameters to use to decode the token, but afterwards have to check that all information
    you used was indeed correct using the claims in the token payload.

    :param token: The JWT token to extract the headers from.
    """
    return pyjwt.get_unverified_header(token.encode("UTF-8"))  # type: ignore


def peek_claims(token: str) -> Mapping[str, str]:
    """Returns the claims (payload) in the JWT token without validation.

    These claims can be used to look up the correct key to use in :func:`decode`.

    :param token: The JWT token to extract the payload from.
    """
    # This type is checked in the tests so this is fine.
    return pyjwt.decode(token, options={"verify_signature": False})  # type: ignore


def decode(
    token: str,
    key: str,
    *,  # Force passing optional arguments by keyword
    audience: Optional[Union[str, bool]] = None,
    algorithms: List[str] = ["HS256"],
) -> Mapping[str, str]:
    """Returns the claims (payload) in the JWT token.

    This will raise an exception if the claims can not be validated with the provided key.

    :param token: The JWT token to decode.
    :param key: The key as bytes.  Depending on the algorithm this can have several formats,
       e.g. for HS256 it can be any string of characters, for RS256 it must be PEM formatted
       RSA PRIVATE_KEY.
    :param audience: Set this to the audience you expect to be present in the claims.  Set
       this to ``False`` to disable verifying the audience.
    :param algorithms: The algorithms which should be tried to verify the payload.
    """
    # TODO: We do not currently have type-safety for keys suitable for decoding *and*
    # encoding vs those only suitable for decoding.
    options = {"verify": True}
    kwargs = dict()
    if audience is False:
        options["verify_aud"] = False
    elif audience is True:
        raise ValueError("audience can not be True")
    elif audience is not None:
        kwargs["audience"] = audience
    if algorithms is None:
        algorithms = ["HS256"]
    # This type is checked in the tests so this is fine.
    return pyjwt.decode(token, key, options=options, algorithms=algorithms, **kwargs)  # type: ignore


def encode(
    payload: Mapping[str, str],
    key: str,
    *,  # Force passing optional arguments by keyword
    algorithm: str = "HS256",
    headers: Optional[Mapping[str, str]] = None,
) -> str:
    """Encode a JWT token containing the provided payload/claims.

    :param payload: The JSON payload to create a token for, not yet encoded to JSON.
    :param key: The key as bytes.  The exactly required shape of the bytes depends on the
       algorithm chosen, see :func:decode:.
    :param algorithm: The algorithm used to sign the payload.
    :param headers: Any headers to encode into the token.  Headers are not part of the
       signed payload and can be tampered with.  They can however help identify the key that
       needs to be used to verify the payload, as long as the payload contains enough
       information to also validate the key used was correct.
    """
    # TODO: We do not currently have type-safety for keys suitable for decoding *and*
    # encoding vs those only suitable for decoding.
    if headers is None:
        headers = {}
    # This type is checked in the tests so this is fine.
    return pyjwt.encode(payload, key, algorithm=algorithm, headers=headers)  # type: ignore


def authorization_header(token: str, *, scheme: str = "Bearer") -> Mapping[str, str]:
    """Returns an authorization header for the given token.

    The returned header can be used with ``requests``, if you already have any headers in a
    dictionary you can use ``headers.update(authorization_header(...))`` to add the
    authorization header.

    Typically JWT uses the token in the "Bearer" scheme for the authorisation header.  If
    you need to use a differnt scheme use the `scheme` argument to change this.

    :param token: The JWT token to use in the authorization header.
    :param scheme: The authorisation scheme to use.
    """
    return {"Authorization": f"{scheme} {token}"}


def rsa_key_from_jwk(jwk: str) -> str:
    """Returns an RSA key from a serialised JWK.

    This constructs an RSA key from a JSON Web Key, the result can be used as key to
    :func:`encode` and should be directly passed to it.

    :param jwk: The JSON Web Key as encoded JSON.
    """
    key = pyjwt.algorithms.RSAAlgorithm.from_jwk(jwk)
    if isinstance(key, RSAPrivateKey):
        # The return type is verified in our own tests, this is fine.
        return key.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()).decode("UTF-8")  # type: ignore
    elif isinstance(key, RSAPublicKey):
        return key.public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo).decode("UTF-8")
    else:
        raise ValueError("Unknown RSA JWK key")
