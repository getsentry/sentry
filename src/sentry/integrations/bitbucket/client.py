from __future__ import absolute_import

import datetime
import jwt

from unidiff import PatchSet

from six.moves.urllib.parse import urlparse

from sentry.utils.http import absolute_uri
from sentry.integrations.atlassian_connect import get_query_hash
from sentry.integrations.client import ApiClient

BITBUCKET_KEY = '%s.bitbucket' % urlparse(absolute_uri()).hostname


class BitbucketAPIPath(object):
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

    def __init__(self, base_url, shared_secret, subject):
        # subject is probably the clientKey
        super(BitbucketAPI, self).__init__()
        self.base_url = base_url
        self.shared_secret = shared_secret
        self.subject = subject

    # TODO(LB): do has_auth and bind_auth belong here?

    def request(self, method, path, data=None, params=None, **kwargs):
        jwt_payload = {
            'iss': BITBUCKET_KEY,
            'iat': datetime.datetime.utcnow(),
            'exp': datetime.datetime.utcnow() + datetime.timedelta(seconds=5 * 60),
            'qsh': get_query_hash(path, method.upper(), params),
            'sub': self.subject,
        }
        encoded_jwt = jwt.encode(jwt_payload, self.shared_secret)
        headers = {
            'Authorization': 'JWT %s' % encoded_jwt
        }
        return self._request(method, path, data=data, params=params, headers=headers, **kwargs)

    def get_issue(self, username, repo_slug, issue_id):
        return self.get(BitbucketAPIPath.issue.format(
            username=username,
            repo_slug=repo_slug,
            issue_id=issue_id,
        ))

    def create_issue(self, username, repo_slug, data):
        return self.post(
            path=BitbucketAPIPath.issues.format(
                username=username,
                repo_slug=repo_slug,
            ),
            data=data,
        )

    def search_issues(self, username, repo_slug, query):
        # Query filters can be found here:
        # https://developer.atlassian.com/bitbucket/api/2/reference/meta/filtering#supp-endpoints
        return self.get(
            path=BitbucketAPIPath.issues.format(
                username=username,
                repo_slug=repo_slug,
            ),
            params={'q': query},
        )

    def create_comment(self, username, repo_slug, issue_id, data):
        # Call the method as below:
        # client.create_comment('username', 'repo_slug', '1', {"content": {"raw": "Whatever you're commenting."}})
        # https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/issues/%7Bissue_id%7D/comments#post
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
        resp = self.get(
            BitbucketAPIPath.repository_diff.format(
                username=username,
                repo_slug=repo_slug,
                spec=sha,  # TODO(LB): sha vs spec????
            ),
            allow_text=True,
        )
        diff_file = resp.text
        ps = PatchSet.from_string(diff_file)
        return self.transform_patchset(ps)

    def zip_commit_data(self, username, repo_slug, commit_list):
        for commit in commit_list:
            commit.update(
                {'patch_set': self.get_commit_filechanges(username, repo_slug, commit['hash'])})
        return commit_list

    def get_last_commits(self, username, repo_slug, end_sha):
        # return api request that fetches last ~30 commits
        # see https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/commits/%7Brevision%7D
        # using end_sha as parameter
        data = self.get(BitbucketAPIPath.repository_commits.format(
            username=username,
            repo_slug=repo_slug,
            revision=end_sha,
        ))
        return self.zip_commit_data(username, repo_slug, data['values'])

    def compare_commits(self, username, repo_slug, start_sha, end_sha):
        # where start_sha is oldest and end_sha is most recent
        # see
        # https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/commits/%7Brevision%7D
        commits = []
        done = False

        url = BitbucketAPIPath.repository_commits.format(
            username=username,
            repo_slug=repo_slug,
            revision=end_sha,
        )

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

        return self.zip_commit_data(username, repo_slug, commits)
