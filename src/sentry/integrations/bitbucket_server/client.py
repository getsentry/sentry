from __future__ import absolute_import

from oauthlib.oauth1 import SIGNATURE_RSA
from requests_oauthlib import OAuth1
from six.moves.urllib.parse import parse_qsl
from sentry.integrations.client import ApiClient
from sentry.shared_integrations.exceptions import ApiError


class BitbucketServerAPIPath(object):
    """
    project is the short key of the project
    repo is the fully qualified slug
    """

    repository = u"/rest/api/1.0/projects/{project}/repos/{repo}"
    repositories = u"/rest/api/1.0/repos"
    repository_hook = u"/rest/api/1.0/projects/{project}/repos/{repo}/webhooks/{id}"
    repository_hooks = u"/rest/api/1.0/projects/{project}/repos/{repo}/webhooks"
    repository_commits = u"/rest/api/1.0/projects/{project}/repos/{repo}/commits"
    commit_changes = u"/rest/api/1.0/projects/{project}/repos/{repo}/commits/{commit}/changes"


class BitbucketServerSetupClient(ApiClient):
    """
    Client for making requests to Bitbucket Server to follow OAuth1 flow.
    """

    request_token_url = u"{}/plugins/servlet/oauth/request-token"
    access_token_url = u"{}/plugins/servlet/oauth/access-token"
    authorize_url = u"{}/plugins/servlet/oauth/authorize?oauth_token={}"
    integration_name = "bitbucket_server_setup"

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


class BitbucketServer(ApiClient):
    """
    Contains the BitBucket Server specifics in order to communicate with bitbucket

    You can find BitBucket REST API docs here:

    https://developer.atlassian.com/server/bitbucket/reference/rest-api/
    """

    integration_name = "bitbucket_server"

    def __init__(self, base_url, credentials, verify_ssl):
        super(BitbucketServer, self).__init__(verify_ssl)

        self.base_url = base_url
        self.credentials = credentials

    def get_repos(self):
        return self.get(
            BitbucketServerAPIPath.repositories,
            auth=self.get_auth(),
            params={"limit": 250, "permission": "REPO_ADMIN"},
        )

    def search_repositories(self, query_string):
        return self.get(
            BitbucketServerAPIPath.repositories,
            auth=self.get_auth(),
            params={"limit": 250, "permission": "REPO_ADMIN", "name": query_string},
        )

    def get_repo(self, project, repo):
        return self.get(
            BitbucketServerAPIPath.repository.format(project=project, repo=repo),
            auth=self.get_auth(),
        )

    def create_hook(self, project, repo, data):
        return self.post(
            BitbucketServerAPIPath.repository_hooks.format(project=project, repo=repo),
            auth=self.get_auth(),
            data=data,
        )

    def delete_hook(self, project, repo, webhook_id):
        return self.delete(
            BitbucketServerAPIPath.repository_hook.format(
                project=project, repo=repo, id=webhook_id
            ),
            auth=self.get_auth(),
        )

    def get_commits(self, project, repo, fromHash, toHash):
        return self.get(
            BitbucketServerAPIPath.repository_commits.format(project=project, repo=repo),
            auth=self.get_auth(),
            params={"since": fromHash, "until": toHash, "merges": "exclude"},
        )

    def get_last_commits(self, project, repo, limit=10):
        return self.get(
            BitbucketServerAPIPath.repository_commits.format(project=project, repo=repo),
            auth=self.get_auth(),
            params={"merges": "exclude", "limit": limit},
        )

    def get_commit_filechanges(self, project, repo, commit):
        return self.get(
            BitbucketServerAPIPath.commit_changes.format(project=project, repo=repo, commit=commit),
            auth=self.get_auth(),
        )

    def get_auth(self):
        return OAuth1(
            client_key=self.credentials["consumer_key"],
            rsa_key=self.credentials["private_key"],
            resource_owner_key=self.credentials["access_token"],
            resource_owner_secret=self.credentials["access_token_secret"],
            signature_method=SIGNATURE_RSA,
            signature_type="auth_header",
        )
