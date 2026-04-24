from __future__ import annotations

import hashlib
from collections.abc import Mapping, Sequence
from enum import StrEnum

import requests
from django.http import HttpRequest
from jwt import DecodeError, ExpiredSignatureError, InvalidKeyError, InvalidSignatureError

from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.silo.base import control_silo_function
from sentry.utils import jwt
from sentry.utils.http import absolute_uri, percent_encode


class AtlassianConnectFailureReason(StrEnum):
    MISSING_AUTHORIZATION_HEADER = "Missing/Invalid authorization header"
    NO_TOKEN_PARAMETER = "No token parameter"
    NO_INTEGRATION_FOUND = "No integration found"
    INVALID_SIGNATURE = "Signature is invalid"
    EXPIRED_SIGNATURE = "Signature is expired"
    QUERY_HASH_MISMATCH = "Query hash mismatch"
    UNABLE_TO_VERIFY_ASYMMETRIC_JWT = "Unable to verify asymmetric installation JWT"
    FAILED_TO_RETRIEVE_TOKEN = "Failed to retrieve token from request headers"
    FAILED_TO_FETCH_KEY_ID = "Failed to fetch key_id (kid)"
    MISSING_KEY_ID = "Missing key_id (kid)"
    INVALID_KEY_ID = "JWT contained invalid key_id (kid)"
    EXPIRED_SIGNATURE_TOKEN = "Expired signature"
    INVALID_SIGNATURE_TOKEN = "JWT contained invalid signature"
    COULD_NOT_DECODE_JWT = "Could not decode JWT token"


class AtlassianConnectValidationError(Exception):
    pass


def get_query_hash(
    uri: str, method: str, query_params: Mapping[str, str | Sequence[str]] | None = None
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
            if isinstance(v, str):
                param_val = percent_encode(v)
            else:
                param_val = ",".join(percent_encode(val) for val in v)
            sorted_query.append(f"{percent_encode(k)}={param_val}")

    query_string = "{}&{}&{}".format(method, uri, "&".join(sorted_query))
    return hashlib.sha256(query_string.encode("utf8")).hexdigest()


def get_token(request: HttpRequest) -> str:
    try:
        # request.headers = {"Authorization": "JWT abc123def456"}
        auth_header: str = request.META["HTTP_AUTHORIZATION"]
        return auth_header.split(" ", 1)[1]
    except (KeyError, IndexError):
        raise AtlassianConnectValidationError(
            AtlassianConnectFailureReason.MISSING_AUTHORIZATION_HEADER
        )


def get_integration_from_jwt(
    token: str | None,
    path: str,
    provider: str,
    query_params: Mapping[str, str] | None,
    method: str = "GET",
) -> RpcIntegration:
    # https://developer.atlassian.com/static/connect/docs/latest/concepts/authentication.html
    # Extract the JWT token from the request's jwt query
    # parameter or the authorization header.
    if token is None:
        raise AtlassianConnectValidationError(AtlassianConnectFailureReason.NO_TOKEN_PARAMETER)
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
    integration = integration_service.get_integration(provider=provider, external_id=issuer)
    if not integration:
        raise AtlassianConnectValidationError(AtlassianConnectFailureReason.NO_INTEGRATION_FOUND)
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
    except InvalidSignatureError as e:
        raise AtlassianConnectValidationError(
            AtlassianConnectFailureReason.INVALID_SIGNATURE
        ) from e
    except ExpiredSignatureError as e:
        raise AtlassianConnectValidationError(
            AtlassianConnectFailureReason.EXPIRED_SIGNATURE
        ) from e

    verify_claims(decoded_claims, path, query_params, method)

    return integration


def verify_claims(
    claims: Mapping[str, str],
    path: str,
    query_params: Mapping[str, str] | None,
    method: str,
) -> None:
    # Verify the query has not been tampered by Creating a Query Hash
    # and comparing it against the qsh claim on the verified token.
    qsh = get_query_hash(path, method, query_params)
    if qsh != claims["qsh"]:
        raise AtlassianConnectValidationError(AtlassianConnectFailureReason.QUERY_HASH_MISMATCH)


def authenticate_asymmetric_jwt(token: str | None, key_id: str) -> dict[str, str]:
    """
    Allows for Atlassian Connect installation lifecycle security improvements (i.e. verified senders)
    See: https://community.developer.atlassian.com/t/action-required-atlassian-connect-installation-lifecycle-security-improvements/49046
    """
    if token is None:
        raise AtlassianConnectValidationError(AtlassianConnectFailureReason.NO_TOKEN_PARAMETER)
    headers = jwt.peek_header(token)
    key_response = requests.get(f"https://connect-install-keys.atlassian.com/{key_id}")
    public_key = key_response.content.decode("utf-8").strip()
    decoded_claims = jwt.decode(
        token, public_key, audience=absolute_uri(), algorithms=[headers.get("alg")]
    )
    if not decoded_claims:
        raise AtlassianConnectValidationError(
            AtlassianConnectFailureReason.UNABLE_TO_VERIFY_ASYMMETRIC_JWT
        )
    return decoded_claims


def get_integration_from_request(request: HttpRequest, provider: str) -> RpcIntegration:
    return get_integration_from_jwt(request.GET.get("jwt"), request.path, provider, request.GET)


@control_silo_function
def parse_integration_from_request(request: HttpRequest, provider: str) -> Integration | None:
    token = (
        get_token(request=request)
        if request.META.get("HTTP_AUTHORIZATION") is not None
        else request.GET.get("jwt")
    )
    rpc_integration = get_integration_from_jwt(
        token=token,
        path=request.path,
        provider=provider,
        query_params=request.GET,
        method=request.method if request.method else "POST",
    )
    return Integration.objects.filter(id=rpc_integration.id).first()


class AtlassianConnectTokenValidator:
    def __init__(self, request: HttpRequest, method: str) -> None:
        self.request = request
        self.method = method

    def get_token(self) -> str:
        token = get_token(self.request)

        self._validate_token(token)
        return token

    def _validate_token(self, token: str) -> None:
        try:
            key_id = jwt.peek_header(token).get("kid")
        except DecodeError:
            raise AtlassianConnectValidationError(
                AtlassianConnectFailureReason.FAILED_TO_FETCH_KEY_ID
            )
        if not key_id:
            raise AtlassianConnectValidationError(AtlassianConnectFailureReason.MISSING_KEY_ID)
        try:
            decoded_claims = authenticate_asymmetric_jwt(token, key_id)
            verify_claims(decoded_claims, self.request.path, self.request.GET, self.method)
        except InvalidKeyError:
            raise AtlassianConnectValidationError(AtlassianConnectFailureReason.INVALID_KEY_ID)
        except ExpiredSignatureError:
            raise AtlassianConnectValidationError(
                AtlassianConnectFailureReason.EXPIRED_SIGNATURE_TOKEN
            )
        except InvalidSignatureError:
            raise AtlassianConnectValidationError(
                AtlassianConnectFailureReason.INVALID_SIGNATURE_TOKEN
            )
        except DecodeError:
            raise AtlassianConnectValidationError(
                AtlassianConnectFailureReason.COULD_NOT_DECODE_JWT
            )
