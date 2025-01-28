from __future__ import annotations

import datetime
import logging
from typing import Any
from urllib.parse import parse_qs, urlparse, urlsplit

from requests import PreparedRequest

from sentry.integrations.base import IntegrationFeatureNotImplementedError
from sentry.integrations.client import ApiClient
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.source_code_management.repository import RepositoryClient
from sentry.integrations.utils.atlassian_connect import get_query_hash
from sentry.models.repository import Repository
from sentry.utils import jwt
from sentry.utils.http import absolute_uri
from sentry.utils.patch_set import patch_to_file_changes

BITBUCKET_KEY = f"{urlparse(absolute_uri()).hostname}.bitbucket"

logger = logging.getLogger(__name__)


class BitbucketAPIPath:
    """
    All UUID's must be surrounded by curlybraces.

    repo is the fully qualified slug containing 'username/repo_slug'

    repo_slug - repository slug or UUID
    username - username or UUID
    """

    issue = "/2.0/repositories/{repo}/issues/{issue_id}"
    issues = "/2.0/repositories/{repo}/issues"
    issue_comments = "/2.0/repositories/{repo}/issues/{issue_id}/comments"

    repository = "/2.0/repositories/{repo}"
    repositories = "/2.0/repositories/{username}"
    repository_commits = "/2.0/repositories/{repo}/commits/{revision}"
    repository_diff = "/2.0/repositories/{repo}/diff/{spec}"
    repository_hook = "/2.0/repositories/{repo}/hooks/{uid}"
    repository_hooks = "/2.0/repositories/{repo}/hooks"

    source = "/2.0/repositories/{repo}/src/{sha}/{path}"


class BitbucketApiClient(ApiClient, RepositoryClient):
    """
    The API Client for the Bitbucket Integration

    NOTE: repo is the fully qualified slug containing 'username/repo_slug'
    """

    integration_name = "bitbucket"

    def __init__(self, integration: RpcIntegration):
        self.base_url = integration.metadata["base_url"]
        self.shared_secret = integration.metadata["shared_secret"]
        # subject is probably the clientKey
        self.subject = integration.external_id

        super().__init__(
            integration_id=integration.id,
            verify_ssl=True,
            logging_context=None,
        )

    def finalize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        path = prepared_request.url[len(self.base_url) :]
        url_params = dict(parse_qs(urlsplit(path).query))
        path = path.split("?")[0]
        jwt_payload = {
            "iss": BITBUCKET_KEY,
            "iat": datetime.datetime.utcnow(),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=5 * 60),
            "qsh": get_query_hash(
                uri=path, method=prepared_request.method.upper(), query_params=url_params
            ),
            "sub": self.subject,
        }
        encoded_jwt = jwt.encode(jwt_payload, self.shared_secret)
        prepared_request.headers["Authorization"] = f"JWT {encoded_jwt}"
        return prepared_request

    def get_issue(self, repo, issue_id):
        return self.get(BitbucketAPIPath.issue.format(repo=repo, issue_id=issue_id))

    def create_issue(self, repo, data):
        return self.post(path=BitbucketAPIPath.issues.format(repo=repo), data=data)

    def search_issues(self, repo: str, query: str) -> dict[str, Any]:
        # Query filters can be found here:
        # https://developer.atlassian.com/bitbucket/api/2/reference/meta/filtering#supp-endpoints
        return self.get(path=BitbucketAPIPath.issues.format(repo=repo), params={"q": query})

    def create_comment(self, repo, issue_id, data):
        # Call the method as below:
        # client.create_comment('repo', '1', {"content": {"raw": "Whatever you're commenting."}})
        # https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/issues/%7Bissue_id%7D/comments#post
        return self.post(
            path=BitbucketAPIPath.issue_comments.format(repo=repo, issue_id=issue_id), data=data
        )

    def get_repo(self, repo):
        return self.get(BitbucketAPIPath.repository.format(repo=repo))

    def get_repos(self, username):
        return self.get(BitbucketAPIPath.repositories.format(username=username))

    def search_repositories(self, username, query):
        return self.get(
            path=BitbucketAPIPath.repositories.format(username=username), params={"q": query}
        )

    def create_hook(self, repo, data):
        return self.post(path=BitbucketAPIPath.repository_hooks.format(repo=repo), data=data)

    def get_hooks(self, repo):
        return self.get(path=BitbucketAPIPath.repository_hooks.format(repo=repo))

    def delete_hook(self, repo, hook_id):
        return self.delete(path=BitbucketAPIPath.repository_hook.format(repo=repo, uid=hook_id))

    def get_commit_filechanges(self, repo, sha):
        resp = self.get(
            BitbucketAPIPath.repository_diff.format(repo=repo, spec=sha), allow_text=True
        )
        return patch_to_file_changes(resp.text)

    def zip_commit_data(self, repo, commit_list):
        for commit in commit_list:
            commit.update({"patch_set": self.get_commit_filechanges(repo, commit["hash"])})
        return commit_list

    def get_last_commits(self, repo, end_sha):
        # return api request that fetches last ~30 commits
        # see https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/commits/%7Brevision%7D
        # using end_sha as parameter
        data = self.get(BitbucketAPIPath.repository_commits.format(repo=repo, revision=end_sha))
        return self.zip_commit_data(repo, data["values"])

    def compare_commits(self, repo, start_sha, end_sha):
        # where start_sha is oldest and end_sha is most recent
        # see
        # https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/commits/%7Brevision%7D
        commits = []
        done = False

        url = BitbucketAPIPath.repository_commits.format(repo=repo, revision=end_sha)

        while not done and len(commits) < 90:
            data = self.get(url)

            for commit in data["values"]:
                if commit["hash"] == start_sha:
                    done = True
                    break
                commits.append(commit)

            # move page forward
            try:
                url = data["next"]
            except KeyError:
                break

        return self.zip_commit_data(repo, commits)

    def check_file(self, repo: Repository, path: str, version: str | None) -> object | None:
        return self.head_cached(
            path=BitbucketAPIPath.source.format(
                repo=repo.name,
                sha=version,
                path=path,
            ),
        )

    def get_file(
        self, repo: Repository, path: str, ref: str | None, codeowners: bool = False
    ) -> str:
        raise IntegrationFeatureNotImplementedError
