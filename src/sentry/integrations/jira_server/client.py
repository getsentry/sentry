from __future__ import absolute_import

import jwt

from django.core.urlresolvers import reverse
from oauthlib.oauth1 import SIGNATURE_RSA
from requests_oauthlib import OAuth1
from six.moves.urllib.parse import parse_qsl

from sentry.integrations.jira.client import JiraApiClient
from sentry.integrations.client import ApiClient
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.http import absolute_uri


class JiraServerClient(JiraApiClient):
    integration_name = "jira_server"


class JiraServerSetupClient(ApiClient):
    """
    Client for making requests to JiraServer to follow OAuth1 flow.

    Jira OAuth1 docs: https://developer.atlassian.com/server/jira/platform/oauth/
    """

    request_token_url = u"{}/plugins/servlet/oauth/request-token"
    access_token_url = u"{}/plugins/servlet/oauth/access-token"
    authorize_url = u"{}/plugins/servlet/oauth/authorize?oauth_token={}"
    integration_name = "jira_server_setup"

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
        return self.authorize_url.format(self.base_url, request_token["oauth_token"])

    def get_access_token(self, request_token, verifier):
        """
        Step 3 of the oauth flow.
        Use the verifier and request token from step 1 to get an access token.
        """
        if not verifier:
            raise ApiError("Missing OAuth token verifier")
        auth = OAuth1(
            client_key=self.consumer_key,
            resource_owner_key=request_token["oauth_token"],
            resource_owner_secret=request_token["oauth_token_secret"],
            verifier=verifier,
            rsa_key=self.private_key,
            signature_method=SIGNATURE_RSA,
            signature_type="auth_header",
        )
        url = self.access_token_url.format(self.base_url)
        resp = self.post(url, auth=auth, allow_text=True)
        return dict(parse_qsl(resp.text))

    def create_issue_webhook(self, external_id, secret, credentials):
        auth = OAuth1(
            client_key=credentials["consumer_key"],
            rsa_key=credentials["private_key"],
            resource_owner_key=credentials["access_token"],
            resource_owner_secret=credentials["access_token_secret"],
            signature_method=SIGNATURE_RSA,
            signature_type="auth_header",
        )

        # Create a JWT token that we can add to the webhook URL
        # so we can locate the matching integration later.
        token = jwt.encode({"id": external_id}, secret)
        path = reverse("sentry-extensions-jiraserver-issue-updated", kwargs={"token": token})
        data = {
            "name": "Sentry Issue Sync",
            "url": absolute_uri(path),
            "events": ["jira:issue_created", "jira:issue_updated"],
        }
        return self.post("/rest/webhooks/1.0/webhook", auth=auth, data=data)

    def request(self, *args, **kwargs):
        """
        Add OAuth1 RSA signatures.
        """
        if "auth" not in kwargs:
            kwargs["auth"] = OAuth1(
                client_key=self.consumer_key,
                rsa_key=self.private_key,
                signature_method=SIGNATURE_RSA,
                signature_type="auth_header",
            )
        return self._request(*args, **kwargs)


class JiraServer(object):
    """
    Contains the jira-server specifics that a JiraClient needs
    in order to communicate with jira

    You can find JIRA REST API docs here:

    https://developer.atlassian.com/server/jira/platform/rest-apis/
    """

    def __init__(self, credentials):
        self.credentials = credentials

    @property
    def cache_prefix(self):
        return "sentry-jira-server:"

    def request_hook(self, method, path, data, params, **kwargs):
        """
        Used by Jira Client to apply the jira-server authentication
        Which is RSA signed OAuth1
        """
        if "auth" not in kwargs:
            kwargs["auth"] = OAuth1(
                client_key=self.credentials["consumer_key"],
                rsa_key=self.credentials["private_key"],
                resource_owner_key=self.credentials["access_token"],
                resource_owner_secret=self.credentials["access_token_secret"],
                signature_method=SIGNATURE_RSA,
                signature_type="auth_header",
            )

        request_spec = kwargs.copy()
        request_spec.update(dict(method=method, path=path, data=data, params=params))
        return request_spec

    def user_id_field(self):
        """
        Jira-Server doesn't require GDPR compliant API usage so we can use `name`
        """
        return "name"

    def query_field(self):
        """
        Jira-Server doesn't require GDPR compliant API usage so we can use `username`
        """
        return "username"
