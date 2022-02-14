import hashlib
from typing import Mapping, Optional, Sequence, Union

import requests
from jwt import InvalidSignatureError
from rest_framework.request import Request

from sentry.models import Integration
from sentry.utils import jwt
from sentry.utils.http import absolute_uri, percent_encode


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
    claims = jwt.peek_claims(token)
    headers = jwt.peek_header(token)

    # Extract the issuer ('iss') claim from the decoded, unverified
    # claims object. This is the clientKey for the tenant - an identifier
    # for the Atlassian application making the call
    issuer = claims.get("iss")
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
    key_id = headers.get("kid")
    try:
        # We only authenticate asymmetrically (through the CDN) if the event provides a key ID
        # in its JWT headers. This should only appear for install/uninstall events.

        decoded_claims = (
            authenticate_asymmetric_jwt(token, key_id)
            if key_id
            else jwt.decode(token, integration.metadata["shared_secret"], audience=False)
        )
    except InvalidSignatureError:
        raise AtlassianConnectValidationError("Signature is invalid")

    verify_claims(decoded_claims, path, query_params, method)

    return integration


def verify_claims(
    claims: Optional[Mapping[str, str]],
    path: str,
    query_params: Optional[Mapping[str, str]],
    method: str,
) -> None:
    # Verify the query has not been tampered by Creating a Query Hash
    # and comparing it against the qsh claim on the verified token.
    qsh = get_query_hash(path, method, query_params)
    if qsh != claims["qsh"]:
        raise AtlassianConnectValidationError("Query hash mismatch")


def authenticate_asymmetric_jwt(token: Optional[str], key_id: str) -> Optional[Mapping[str, str]]:
    """
    Allows for Atlassian Connect installation lifecycle security improvements (i.e. verified senders)
    See: https://community.developer.atlassian.com/t/action-required-atlassian-connect-installation-lifecycle-security-improvements/49046
    """
    if token is None:
        raise AtlassianConnectValidationError("No token parameter")
    headers = jwt.peek_header(token)
    key_response = requests.get(f"https://connect-install-keys.atlassian.com/{key_id}")
    public_key = key_response.content.decode("utf-8").strip()
    decoded_claims = jwt.decode(
        token, public_key, audience=absolute_uri(), algorithms=[headers.get("alg")]
    )
    if not decoded_claims:
        raise AtlassianConnectValidationError("Unable to verify asymmetric installation JWT")
    return decoded_claims


def get_integration_from_request(request: Request, provider: str) -> Integration:
    return get_integration_from_jwt(request.GET.get("jwt"), request.path, provider, request.GET)
