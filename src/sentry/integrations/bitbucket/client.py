from __future__ import absolute_import

from enum import Enum
from unidiff import PatchSet

from six.moves.urllib.parse import urlparse

from sentry.utils.http import absolute_uri
from sentry.integrations.atlassian_connect import integration_request
from sentry.integrations.client import ApiClient

BITBUCKET_KEY = '%s.bitbucket' % urlparse(absolute_uri()).hostname


class BitbucketAPIPath(Enum):
    """
    All UUID's must be surrounded by culybraces.
    repo_slug - repository slug or UUID
    username - username or UUID

    """

    issue = u'/2.0/repositories/{username}/{repo_slug}/issues/{issue_id}'
    issues = u'/2.0/repositories/{username}/{repo_slug}/issues'
    issue_comments = u'/2.0/repositories/{username}/{repo_slug}/issues/{issue_id}/comments'

    repository = u'/2.0/repositories/{username}/{repo_slug}'
    repository_commits = u'/2.0/repositories/{username}/{repo_slug}/commits/{revision}'
    repository_diff = u'/2.0/repositories/{username}/{repo_slug}/diff/{spec}'
    repository_hook = u'/2.0/repositories/{username}/{repo_slug}/hooks/{uid}'
    repository_hooks = u'/2.0/repositories/{username}/{repo_slug}/hooks'


class BitbucketAPI(ApiClient):
    ALL_REPO_URL = '/2.0/repositories/%s'

    def __init__(self, base_url, shared_secret):
        self.base_url = base_url
        self.shared_secret = shared_secret

    def get_all_repositories(self, account):
        # Account can be either Team or User
        return integration_request(
            method='GET',
            path=self.ALL_REPO_URL % account,
            app_key=BITBUCKET_KEY,
            base_url=self.base_url,
            shared_secret=self.shared_secret,
        )

    # TODO(LB): do has_auth and bind_auth belong here?

    def request(self, method, path, data=None):
        return integration_request(
            method=method,
            path=path,
            app_key=BITBUCKET_KEY,
            base_url=self.base_url,
            shared_secret=self.shared_secret,
            data=data,
        )

    def get_issue(self, username, repo_slug, issue_id):
        return self.get(BitbucketAPIPath.issue.format(
            username=username,
            repo_slug=repo_slug,
            issue_id=issue_id,
        ))

    def create_issue(self, username, repo_slug, data):
        return self.put(
            path=BitbucketAPIPath.issues.format(
                username=username,
                repo_slug=repo_slug,
            ),
            data=data,
        )

    def search_issues(self, username, repo_slug, query):
        return self.get(
            path=BitbucketAPIPath.issues.format(
                username=username,
                repo_slug=repo_slug,
            ),
            params={'search': query},
        )

    def create_comment(self, username, repo_slug, issue_id, data):
        return self.post(
            path=BitbucketAPIPath.issue_comments.format(
                username=username,
                repo_slug=repo_slug,
                issue_id=issue_id,
            ),
            data=data,
        )

    def get_repo(self, username, repo_slug):
        return self.get(BitbucketAPIPath.repository.format(
            username=username,
            repo_slug=repo_slug,
        ))

    def create_hook(self, username, repo_slug, data):
        return self.post(
            path=BitbucketAPIPath.repository_hooks.format(
                username=username,
                repo_slug=repo_slug,
            ),
            data=data
        )

    def delete_hook(self, username, repo_slug, hook_id):
        return self.delete(path=BitbucketAPIPath.repository_hook.format(
            username=username,
            repo_slug=repo_slug,
            uid=hook_id,
        ))

    def transform_patchset(self, patch_set):
        # TODO(LB): copy and paste not sure what this does
        file_changes = []
        for patched_file in patch_set.added_files:
            file_changes.append({
                'path': patched_file.path,
                'type': 'A',
            })

        for patched_file in patch_set.removed_files:
            file_changes.append({
                'path': patched_file.path,
                'type': 'D',
            })

        for patched_file in patch_set.modified_files:
            file_changes.append({
                'path': patched_file.path,
                'type': 'M',
            })

        return file_changes

    def get_commit_filechanges(self, username, repo_slug, sha):
        # TODO(LB): This is a bit more complicated not complete
        resp = self.get(BitbucketAPIPath.repository_diff.format(
            username=username,
            repo_slug=repo_slug,
            spec=sha,  # TODO(LB): sha vs spec????
            # TODO(LB): Missing allow_text=True not a thing in this api version; need to look it up
        ))
        diff_file = resp.text
        ps = PatchSet.from_string(diff_file)
        return self.transform_patchset(ps)

    def zip_commit_data(self, username, repo_slug, commit_list):
        # TODO(LB): copy and paste
        for commit in commit_list:
            commit.update(
                {'patch_set': self.get_commit_filechanges(username, repo_slug, commit['hash'])})
        return commit_list

    def get_last_commits(self, username, repo_slug, end_sha):
        # TODO(LB): check this works as intended

        # return api request that fetches last ~30 commits
        # see https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/commits/%7Brevision%7D
        # using end_sha as parameter
        data = self.get(BitbucketAPIPath.repository_commits.format(
            username=username,
            repo_slug=repo_slug,
            revision=end_sha,
        ))
        return self.zip_commit_data(repo_slug, data['values'])

    def compare_commits(self, username, repo_slug, start_sha, end_sha):
        # where start_sha is oldest and end_sha is most recent
        # see
        # https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/commits/%7Brevision%7D
        commits = []
        done = False

        url = BitbucketAPIPath.repository_commits.format(username, repo_slug, end_sha)

        while not done and len(commits) < 90:
            data = self.get(url)

            for commit in data['values']:
                if commit['hash'] == start_sha:
                    done = True
                    break
                commits.append(commit)

            # move page forward
            try:
                url = data['next']
            except KeyError:
                break

        return self.zip_commit_data(repo_slug, commits)
