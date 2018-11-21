from __future__ import absolute_import

from sentry.integrations.client import ApiClient, ApiError
from requests_oauthlib import OAuth1
from oauthlib.oauth1 import SIGNATURE_RSA
from six.moves.urllib.parse import parse_qsl


class JiraServerSetupClient(ApiClient):
    """
    Client for making requests to JiraServer to follow OAuth1 flow.
    """
    request_token_url = u'{}/plugins/servlet/oauth/request-token'
    access_token_url = u'{}/plugins/servlet/oauth/access-token'
    authorize_url = u'{}/plugins/servlet/oauth/authorize?oauth_token={}'

    def __init__(self, base_url, consumer_key, private_key, verify_ssl=True):
        self.base_url = base_url
        self.consumer_key = consumer_key
        self.private_key = private_key
        self.verify_ssl = verify_ssl

    def get_request_token(self):
        """
        Step 1 of the oauth flow.
        Get a request token that we can have the user verify.
        """
        url = self.request_token_url.format(self.base_url)
        resp = self.post(url, allow_text=True)
        return dict(parse_qsl(resp.text))

    def get_authorize_url(self, request_token):
        """
        Step 2 of the oauth flow.
        Get a URL that the user can verify our request token at.
        """
        return self.authorize_url.format(self.base_url, request_token['oauth_token'])

    def get_access_token(self, request_token, verifier):
        """
        Step 3 of the oauth flow.
        Use the verifier and request token from step 1 to get an access token.
        """
        if not verifier:
            raise ApiError('Missing OAuth token verifier')
        auth = OAuth1(
            client_key=self.consumer_key,
            resource_owner_key=request_token['oauth_token'],
            resource_owner_secret=request_token['oauth_token_secret'],
            verifier=verifier,
            rsa_key=self.private_key,
            signature_method=SIGNATURE_RSA,
            signature_type='auth_header')
        url = self.access_token_url.format(self.base_url)
        resp = self.post(url, auth=auth, allow_text=True)
        return dict(parse_qsl(resp.text))

    def request(self, *args, **kwargs):
        """
        Add OAuth1 RSA signatures.
        """
        if 'auth' not in kwargs:
            kwargs['auth'] = OAuth1(
                client_key=self.consumer_key,
                rsa_key=self.private_key,
                signature_method=SIGNATURE_RSA,
                signature_type='auth_header')
        return self._request(*args, **kwargs)


class JiraServerClient(ApiClient):
    """
    Client for making authenticated requests to JiraServer
    """

    def __init__(self, installation):
        self.installation = installation
        verify_ssl = self.metadata['verify_ssl']
        super(JiraServerClient, self).__init__(verify_ssl)

    @property
    def identity(self):
        return self.installation.default_identity

    @property
    def metadata(self):
        return self.installation.model.metadata

    def request(self, *args, **kwargs):
        if 'auth' not in kwargs:
            kwargs['auth'] = OAuth1(
                client_key=self.metadat['consumer_key'],
                rsa_key=self.metadata['private_key'],
                resource_owner_key=self.metadata['access_token'],
                resource_owner_secret=self.metadata['access_token_secret'],
                signature_method=SIGNATURE_RSA,
                signature_type='auth_header')
        return self._request(*args, **kwargs)

    def get_valid_statuses(self):
        # TODO Implement this.
        return []

    def get_projects_list(self):
        # TODO Implement this
        return []
