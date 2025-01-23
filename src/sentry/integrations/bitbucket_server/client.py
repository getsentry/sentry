import logging
from urllib.parse import parse_qsl

from oauthlib.oauth1 import SIGNATURE_RSA
from requests import PreparedRequest
from requests_oauthlib import OAuth1

from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.base import IntegrationFeatureNotImplementedError
from sentry.integrations.client import ApiClient
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.source_code_management.repository import RepositoryClient
from sentry.models.repository import Repository
from sentry.shared_integrations.client.base import BaseApiResponseX
from sentry.shared_integrations.exceptions import ApiError

logger = logging.getLogger("sentry.integrations.bitbucket_server")


class BitbucketServerAPIPath:
    """
    project is the short key of the project
    repo is the fully qualified slug
    """

    repository = "/rest/api/1.0/projects/{project}/repos/{repo}"
    repositories = "/rest/api/1.0/repos"
    repository_hook = "/rest/api/1.0/projects/{project}/repos/{repo}/webhooks/{id}"
    repository_hooks = "/rest/api/1.0/projects/{project}/repos/{repo}/webhooks"
    repository_commits = "/rest/api/1.0/projects/{project}/repos/{repo}/commits"
    commit_changes = "/rest/api/1.0/projects/{project}/repos/{repo}/commits/{commit}/changes"


class BitbucketServerSetupClient(ApiClient):
    """
    Client for making requests to Bitbucket Server to follow OAuth1 flow.
    """

    request_token_url = "{}/plugins/servlet/oauth/request-token"
    access_token_url = "{}/plugins/servlet/oauth/access-token"
    authorize_url = "{}/plugins/servlet/oauth/authorize?oauth_token={}"
    integration_name = "bitbucket_server_setup"

    def __init__(self, base_url, consumer_key, private_key, verify_ssl=True, *args, **kwargs):
        super().__init__(*args, **kwargs)
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
            decoding=None,
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
                decoding=None,
            )
        return self._request(*args, **kwargs)


class BitbucketServerClient(ApiClient, RepositoryClient):
    """
    Contains the BitBucket Server specifics in order to communicate with bitbucket

    You can find BitBucket REST API docs here:

    https://developer.atlassian.com/server/bitbucket/reference/rest-api/
    """

    integration_name = "bitbucket_server"

    def __init__(
        self,
        integration: RpcIntegration,
        identity: RpcIdentity,
    ):
        self.base_url = integration.metadata["base_url"]
        self.identity = identity

        super().__init__(
            verify_ssl=integration.metadata["verify_ssl"],
            integration_id=integration.id,
            logging_context=None,
        )

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        return self.authorize_request(prepared_request=prepared_request)

    def authorize_request(self, prepared_request: PreparedRequest):
        """Bitbucket Server authorizes with RSA-signed OAuth1 scheme"""
        if not self.identity:
            return prepared_request
        auth_scheme = OAuth1(
            client_key=self.identity.data["consumer_key"],
            rsa_key=self.identity.data["private_key"],
            resource_owner_key=self.identity.data["access_token"],
            resource_owner_secret=self.identity.data["access_token_secret"],
            signature_method=SIGNATURE_RSA,
            signature_type="auth_header",
            decoding=None,
        )
        prepared_request.prepare_auth(auth=auth_scheme)
        return prepared_request

    def get_repos(self):
        return self.get(
            BitbucketServerAPIPath.repositories,
            params={"limit": 250, "permission": "REPO_ADMIN"},
        )

    def search_repositories(self, query_string):
        return self.get(
            BitbucketServerAPIPath.repositories,
            params={"limit": 250, "permission": "REPO_ADMIN", "name": query_string},
        )

    def get_repo(self, project, repo):
        return self.get(
            BitbucketServerAPIPath.repository.format(project=project, repo=repo),
        )

    def create_hook(self, project, repo, data):
        return self.post(
            BitbucketServerAPIPath.repository_hooks.format(project=project, repo=repo),
            data=data,
        )

    def delete_hook(self, project, repo, webhook_id):
        return self.delete(
            BitbucketServerAPIPath.repository_hook.format(
                project=project, repo=repo, id=webhook_id
            ),
        )

    def get_commits(self, project, repo, from_hash, to_hash, limit=1000):
        logger.info(
            "load.commits",
            extra={
                "bitbucket_repo": repo,
                "bitbucket_project": project,
                "bitbucket_from_hash": from_hash,
                "bitbucket_to_hash": to_hash,
            },
        )

        return self._get_values(
            BitbucketServerAPIPath.repository_commits.format(project=project, repo=repo),
            {"limit": limit, "since": from_hash, "until": to_hash, "merges": "exclude"},
        )

    def get_last_commits(self, project, repo, limit=10):
        return self.get(
            BitbucketServerAPIPath.repository_commits.format(project=project, repo=repo),
            params={"merges": "exclude", "limit": limit},
        )["values"]

    def get_commit_filechanges(self, project, repo, commit, limit=1000):
        logger.info(
            "load.filechanges",
            extra={
                "bitbucket_repo": repo,
                "bitbucket_project": project,
                "bitbucket_commit": commit,
            },
        )

        return self._get_values(
            BitbucketServerAPIPath.commit_changes.format(project=project, repo=repo, commit=commit),
            {"limit": limit},
        )

    def _get_values(self, uri, params, max_pages=1000000):
        values = []
        start = 0

        logger.info(
            "load.paginated_uri",
            extra={
                "bitbucket_uri": uri,
                "bitbucket_max_pages": max_pages,
                "bitbucket_params": params,
            },
        )

        for i in range(max_pages):
            new_params = dict.copy(params)
            new_params["start"] = start
            logger.debug(
                "Loading values for paginated uri starting from %s",
                start,
                extra={"uri": uri, "params": new_params},
            )
            data = self.get(uri, params=new_params)
            logger.debug(
                "%s values loaded", len(data["values"]), extra={"uri": uri, "params": new_params}
            )

            values += data["values"]

            if "isLastPage" not in data or data["isLastPage"]:
                logger.debug("Reached last page for paginated uri", extra={"uri": uri})
                return values
            else:
                start = data["nextPageStart"]

        logger.warning(
            "load.paginated_uri.max_pages",
            extra={
                "bitbucket_uri": uri,
                "bitbucket_params": params,
                "bitbucket_max_pages": max_pages,
            },
        )
        return values

    def check_file(self, repo: Repository, path: str, version: str | None) -> BaseApiResponseX:
        raise IntegrationFeatureNotImplementedError

    def get_file(self, repo: Repository, path: str, version: str, codeowners: bool = False) -> str:
        raise IntegrationFeatureNotImplementedError
