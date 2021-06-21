import hashlib
from typing import Mapping, Optional, Sequence, Union

from jwt import InvalidSignatureError
from rest_framework.request import Request

from sentry.models import Integration
from sentry.utils import jwt
from sentry.utils.http import percent_encode

__all__ = ["AtlassianConnectValidationError", "get_query_hash", "get_integration_from_request"]


class AtlassianConnectValidationError(Exception):
    pass


def get_query_hash(
    uri: str, method: str, query_params: Optional[Mapping[str, Union[str, Sequence[str]]]] = None
) -> str:
    # see
    # https://developer.atlassian.com/static/connect/docs/latest/concepts/understanding-jwt.html#qsh
    uri = uri.rstrip("/")
    method = method.upper()
    if query_params is None:
        query_params = {}

    sorted_query = []
    for k, v in sorted(query_params.items()):
        # don't include jwt query param
        if k != "jwt":
            if isinstance(v, list):
                param_val = ",".join(percent_encode(val) for val in v)
            else:
                param_val = percent_encode(v)
            sorted_query.append(f"{percent_encode(k)}={param_val}")

    query_string = "{}&{}&{}".format(method, uri, "&".join(sorted_query))
    return hashlib.sha256(query_string.encode("utf8")).hexdigest()


def get_integration_from_jwt(
    token: Optional[str],
    path: str,
    provider: str,
    query_params: Optional[Mapping[str, str]],
    method: str = "GET",
) -> Integration:
    # https://developer.atlassian.com/static/connect/docs/latest/concepts/authentication.html
    # Extract the JWT token from the request's jwt query
    # parameter or the authorization header.
    if token is None:
        raise AtlassianConnectValidationError("No token parameter")
    # Decode the JWT token, without verification. This gives
    # you a header JSON object, a claims JSON object, and a signature.
    decoded = jwt.peek_claims(token)
    # Extract the issuer ('iss') claim from the decoded, unverified
    # claims object. This is the clientKey for the tenant - an identifier
    # for the Atlassian application making the call
    issuer = decoded["iss"]
    # Look up the sharedSecret for the clientKey, as stored
    # by the add-on during the installation handshake
    try:
        integration = Integration.objects.get(provider=provider, external_id=issuer)
    except Integration.DoesNotExist:
        raise AtlassianConnectValidationError("No integration found")
    # Verify the signature with the sharedSecret and the algorithm specified in the header's
    # alg field.  We only need the token + shared secret and do not want to provide an
    # audience to the JWT validation that is require to match.  Bitbucket does give us an
    # audience claim however, so disable verification of this.
    try:
        decoded_verified = jwt.decode(token, integration.metadata["shared_secret"], audience=False)
    except InvalidSignatureError:
        raise AtlassianConnectValidationError("Signature is invalid")

    # Verify the query has not been tampered by Creating a Query Hash
    # and comparing it against the qsh claim on the verified token.

    qsh = get_query_hash(path, method, query_params)
    if qsh != decoded_verified["qsh"]:
        raise AtlassianConnectValidationError("Query hash mismatch")

    return integration


def get_integration_from_request(request: Request, provider: str) -> Integration:
    return get_integration_from_jwt(request.GET.get("jwt"), request.path, provider, request.GET)
