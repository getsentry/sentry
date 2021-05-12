import hashlib

import jwt

from sentry.models import Integration
from sentry.utils.http import percent_encode

__all__ = ["AtlassianConnectValidationError", "get_query_hash", "get_integration_from_request"]


class AtlassianConnectValidationError(Exception):
    pass


def get_query_hash(uri, method, query_params=None):
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
                param_val = ",".join([percent_encode(val) for val in v])
            else:
                param_val = percent_encode(v)
            sorted_query.append(f"{percent_encode(k)}={param_val}")

    query_string = "{}&{}&{}".format(method, uri, "&".join(sorted_query))
    return hashlib.sha256(query_string.encode("utf8")).hexdigest()


def get_integration_from_jwt(token, path, provider, query_params, method="GET"):
    # https://developer.atlassian.com/static/connect/docs/latest/concepts/authentication.html
    # Extract the JWT token from the request's jwt query
    # parameter or the authorization header.
    if token is None:
        raise AtlassianConnectValidationError("No token parameter")
    # Decode the JWT token, without verification. This gives
    # you a header JSON object, a claims JSON object, and a signature.
    decoded = jwt.decode(token, verify=False)
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
    # Verify the signature with the sharedSecret and
    # the algorithm specified in the header's alg field.
    options = {}
    # If it's BitBucket, we only need the token + shared secret
    # it will fail on this: https://github.com/jpadilla/pyjwt/blob/d25c92ca5e9980ca7bc8b31420bf36e3f4a9e3f0/jwt/api_jwt.py#L190
    # if we try to verify the audience
    if provider == "bitbucket":
        options = {"verify_aud": False}

    decoded_verified = jwt.decode(token, integration.metadata["shared_secret"], options=options)
    # Verify the query has not been tampered by Creating a Query Hash
    # and comparing it against the qsh claim on the verified token.

    qsh = get_query_hash(path, method, query_params)
    if qsh != decoded_verified["qsh"]:
        raise AtlassianConnectValidationError("Query hash mismatch")

    return integration


def get_integration_from_request(request, provider):
    return get_integration_from_jwt(request.GET.get("jwt"), request.path, provider, request.GET)
