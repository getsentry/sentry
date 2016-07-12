"""
sentry.nodestore.dynamodb.client
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from hmac import new as hmac_new
from hashlib import sha256
from datetime import datetime
from urlparse import urlparse


# Key derivation functions. See:
# http://docs.aws.amazon.com/general/latest/gr/signature-v4-examples.html#signature-v4-examples-python
def sign(key, msg):
    return hmac_new(key, msg.encode('utf-8'), sha256).digest()


def now():
    t = datetime.utcnow()
    amz_date = t.strftime('%Y%m%dT%H%M%SZ')
    date_stamp = t.strftime('%Y%m%d')  # Date w/o time, used in credential scope
    return date_stamp, amz_date


def get_signature_key(key, date_stamp, region):
    k_date = sign(('AWS4' + key).encode('utf-8'), date_stamp)
    k_region = sign(k_date, region)
    k_service = sign(k_region, 'dynamodb')
    k_signing = sign(k_service, 'aws4_request')
    return k_signing


def sign_request(body, headers, region, access_key, secret_key):
    """
    Mutate a request's headers with a X-Amx-Date and Authorization headers
    needed for AWS.
    """
    # Stamp out current time, and add to headers
    date_stamp, amz_date = now()
    headers['X-Amz-Date'] = amz_date

    # Now we need to construct a canonical request to be signed
    # http://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
    # For DynamoDB, the url and querystring are always the same, so they are hardcoded to
    # '/' and '' respectively

    # Create the list of headers to be signed. Again, for Dynamodb, these never change
    signed_headers = 'content-type;host;x-amz-date;x-amz-target'
    # Extract the values from the headers
    canonical_headers = 'content-type:%(Content-Type)s\nhost:%(Host)s\nx-amz-date:%(X-Amz-Date)s\nx-amz-target:%(X-Amz-Target)s\n' % headers
    # Generate sha256 of request body
    payload_hash = sha256(body).hexdigest()
    # Combine pieces into canonical request
    canonical_request = 'POST\n/\n\n' + canonical_headers + '\n' + signed_headers + '\n' + payload_hash

    # Now we need to create the sha256 signature
    credential_scope = date_stamp + '/' + region + '/dynamodb/aws4_request'
    string_to_sign = 'AWS4-HMAC-SHA256\n' + amz_date + '\n' + credential_scope + '\n' + sha256(canonical_request).hexdigest()

    # Calculate the signature
    signing_key = get_signature_key(secret_key, date_stamp, region)
    signature = hmac_new(signing_key, string_to_sign.encode('utf-8'), sha256).hexdigest()
    authorization_header = 'AWS4-HMAC-SHA256 Credential=' + access_key + '/' + credential_scope + ', ' + 'SignedHeaders=' + signed_headers + ', ' + 'Signature=' + signature

    # Inject this authorization into the headers
    headers['Authorization'] = authorization_header


def create_pool(url, **options):
    scheme = url.scheme
    if scheme == 'http':
        from urllib3 import HTTPConnectionPool
        cls = HTTPConnectionPool
    elif scheme == 'https':
        from urllib3 import HTTPSConnectionPool
        cls = HTTPSConnectionPool
        verify_ssl = options.pop('verify_ssl', True)
        if verify_ssl:
            options.setdefault('cert_reqs', 'CERT_REQUIRED')
        if not options.get('ca_certs'):
            # utilize the ca_certs path from requests since we already depend on it
            # and they bundle a ca cert.
            from requests.certs import where
            options['ca_certs'] = where()
    else:
        raise KeyError('Invalid scheme: %s' % scheme)
    return cls(url.hostname, url.port, **options)


class DynamodbClient(object):
    def __init__(self, access_key, secret_key,
                 region='us-east-1', endpoint=None,
                 **connection_kwargs):
        if not (access_key or secret_key):
            raise ValueError('Must specify both `access_key` and `secret_key`')
        self.access_key = access_key
        self.secret_key = secret_key
        if endpoint is None:
            endpoint = 'https://dynamodb.%(region)s.amazonaws.com'
        self.endpoint = endpoint % {'region': region}
        self.region = region
        url = urlparse(self.endpoint)
        self.host = url.netloc
        self.pool = create_pool(url, **connection_kwargs)

    def urlopen(self, target, body):
        headers = {
            'Host': self.host,
            'X-Amz-Target': target,
            'Content-Type': 'application/x-amz-json-1.0',
        }
        sign_request(body, headers, self.region, self.access_key, self.secret_key)
        return self.pool.urlopen('POST', '/', headers=headers, body=body)

    def close(self):
        self.pool.close()
