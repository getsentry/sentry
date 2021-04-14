import hashlib
from urllib.parse import quote

import jwt

from sentry.shared_integrations.exceptions import ApiError


def percent_encode(val):
    # see https://en.wikipedia.org/wiki/Percent-encoding
    return quote(val.encode("utf8", errors="replace")).replace("%7E", "~").replace("/", "%2F")


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
                param_val = [percent_encode(val) for val in v].join(",")
            else:
                param_val = percent_encode(v)
            sorted_query.append(f"{percent_encode(k)}={param_val}")

    query_string = "{}&{}&{}".format(method, uri, "&".join(sorted_query))
    return hashlib.sha256(query_string.encode("utf8")).hexdigest()


def get_jira_auth_from_request(request):
    # https://developer.atlassian.com/static/connect/docs/latest/concepts/authentication.html
    # Extract the JWT token from the request's jwt query
    # parameter or the authorization header.
    token = request.GET.get("jwt")
    if token is None:
        raise ApiError("No token parameter")
    # Decode the JWT token, without verification. This gives
    # you a header JSON object, a claims JSON object, and a signature.
    decoded = jwt.decode(token, verify=False)
    # Extract the issuer ('iss') claim from the decoded, unverified
    # claims object. This is the clientKey for the tenant - an identifier
    # for the Atlassian application making the call
    issuer = decoded["iss"]
    # Look up the sharedSecret for the clientKey, as stored
    # by the add-on during the installation handshake
    from sentry_plugins.jira_ac.models import JiraTenant

    jira_auth = JiraTenant.objects.get(client_key=issuer)
    # Verify the signature with the sharedSecret and
    # the algorithm specified in the header's alg field.
    decoded_verified = jwt.decode(token, jira_auth.secret)
    # Verify the query has not been tampered by Creating a Query Hash
    # and comparing it against the qsh claim on the verified token.

    # TODO: probably shouldn't need to hardcode get... for post maybe
    # the secret should just be a hidden field in the form ?
    qsh = get_query_hash(request.path, "GET", request.GET)
    # qsh = get_query_hash(request.path, request.method, request.GET)
    if qsh != decoded_verified["qsh"]:
        raise ApiError("Query hash mismatch")

    return jira_auth
