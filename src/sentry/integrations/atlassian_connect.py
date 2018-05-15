from __future__ import absolute_import

import datetime
import hashlib
import jwt

from sentry.http import build_session
from sentry.models import Integration
from sentry.utils.http import percent_encode

__all__ = [
    'AtlassianConnectValidationError',
    'integration_request',
    'get_query_hash',
    'get_integration_from_request',
]


class AtlassianConnectValidationError(Exception):
    pass


def integration_request(method, path, app_key, base_url, shared_secret,
                        data=None, params=None, headers=None, **kwargs):
    jwt_payload = {
        'iss': app_key,
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=5 * 60),
        'qsh': get_query_hash(path, method.upper(), params),
    }
    encoded_jwt = jwt.encode(jwt_payload, shared_secret)
    params = dict(
        jwt=encoded_jwt,
        **(params or {})
    )

    session = build_session()
    resp = session.request(
        method.lower(),
        url='%s%s' % (base_url, path),
        headers=headers,
        json=data,
        params=params,
    )
    resp.raise_for_status()
    return resp.json()


def get_query_hash(uri, method, query_params=None):
    # see
    # https://developer.atlassian.com/static/connect/docs/latest/concepts/understanding-jwt.html#qsh
    uri = uri.rstrip('/')
    method = method.upper()
    if query_params is None:
        query_params = {}

    sorted_query = []
    for k, v in sorted(query_params.items()):
        # don't include jwt query param
        if k != 'jwt':
            if isinstance(v, list):
                param_val = [percent_encode(val) for val in v].join(',')
            else:
                param_val = percent_encode(v)
            sorted_query.append('%s=%s' % (percent_encode(k), param_val))

    query_string = '%s&%s&%s' % (method, uri, '&'.join(sorted_query))
    return hashlib.sha256(query_string.encode('utf8')).hexdigest()


def get_integration_from_request(request):
    # https://developer.atlassian.com/static/connect/docs/latest/concepts/authentication.html
    # Extract the JWT token from the request's jwt query
    # parameter or the authorization header.
    token = request.GET.get('jwt')
    if token is None:
        raise AtlassianConnectValidationError('No token parameter')
    # Decode the JWT token, without verification. This gives
    # you a header JSON object, a claims JSON object, and a signature.
    decoded = jwt.decode(token, verify=False)
    # Extract the issuer ('iss') claim from the decoded, unverified
    # claims object. This is the clientKey for the tenant - an identifier
    # for the Atlassian application making the call
    issuer = decoded['iss']
    # Look up the sharedSecret for the clientKey, as stored
    # by the add-on during the installation handshake
    try:
        integration = Integration.objects.get(
            provider='jira',
            external_id=issuer,
        )
    except Integration.DoesNotExist:
        raise AtlassianConnectValidationError('No integration found')
    # Verify the signature with the sharedSecret and
    # the algorithm specified in the header's alg field.
    decoded_verified = jwt.decode(token, integration.metadata['shared_secret'])
    # Verify the query has not been tampered by Creating a Query Hash
    # and comparing it against the qsh claim on the verified token.

    qsh = get_query_hash(request.path, 'GET', request.GET)
    if qsh != decoded_verified['qsh']:
        raise AtlassianConnectValidationError('Query hash mismatch')

    return integration
