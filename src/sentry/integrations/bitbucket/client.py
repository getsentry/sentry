import datetime
from urllib.parse import urlparse

from unidiff import PatchSet

from sentry.integrations.atlassian_connect import get_query_hash
from sentry.integrations.client import ApiClient
from sentry.utils import jwt
from sentry.utils.http import absolute_uri

BITBUCKET_KEY = f"{urlparse(absolute_uri()).hostname}.bitbucket"


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


class BitbucketApiClient(ApiClient):
    """
    The API Client for the Bitbucket Integration

    NOTE: repo is the fully qualified slug containing 'username/repo_slug'
    """

    integration_name = "bitbucket"

    def __init__(self, base_url, shared_secret, subject, *args, **kwargs):
        # subject is probably the clientKey
        super().__init__(*args, **kwargs)
        self.base_url = base_url
        self.shared_secret = shared_secret
        self.subject = subject

    def request(self, method, path, data=None, params=None, **kwargs):
        jwt_payload = {
            "iss": BITBUCKET_KEY,
            "iat": datetime.datetime.utcnow(),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(seconds=5 * 60),
            "qsh": get_query_hash(path, method.upper(), params),
            "sub": self.subject,
        }
        encoded_jwt = jwt.encode(jwt_payload, self.shared_secret)
        headers = jwt.authorization_header(encoded_jwt, scheme="JWT")
        return self._request(method, path, data=data, params=params, headers=headers, **kwargs)

    def get_issue(self, repo, issue_id):
        return self.get(BitbucketAPIPath.issue.format(repo=repo, issue_id=issue_id))

    def get_issues(self, repo):
        return self.get(BitbucketAPIPath.issues.format(repo=repo))

    def create_issue(self, repo, data):
        return self.post(path=BitbucketAPIPath.issues.format(repo=repo), data=data)

    def search_issues(self, repo, query):
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

    def transform_patchset(self, patch_set):
        file_changes = []
        for patched_file in patch_set.added_files:
            file_changes.append({"path": patched_file.path, "type": "A"})

        for patched_file in patch_set.removed_files:
            file_changes.append({"path": patched_file.path, "type": "D"})

        for patched_file in patch_set.modified_files:
            file_changes.append({"path": patched_file.path, "type": "M"})

        return file_changes

    def get_commit_filechanges(self, repo, sha):
        resp = self.get(
            BitbucketAPIPath.repository_diff.format(repo=repo, spec=sha), allow_text=True
        )
        diff_file = resp.text
        ps = PatchSet.from_string(diff_file)
        return self.transform_patchset(ps)

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
