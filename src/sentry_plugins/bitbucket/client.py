from __future__ import absolute_import

import six

from django.conf import settings
from requests_oauthlib import OAuth1
from unidiff import PatchSet

from sentry_plugins.client import AuthApiClient


class BitbucketClient(AuthApiClient):
    base_url = "https://api.bitbucket.org"
    plugin_name = "bitbucket"

    def has_auth(self):
        return (
            self.auth
            and "oauth_token" in self.auth.tokens
            and "oauth_token_secret" in self.auth.tokens
        )

    def bind_auth(self, **kwargs):
        kwargs["auth"] = OAuth1(
            six.text_type(settings.BITBUCKET_CONSUMER_KEY),
            six.text_type(settings.BITBUCKET_CONSUMER_SECRET),
            self.auth.tokens["oauth_token"],
            self.auth.tokens["oauth_token_secret"],
            signature_type="auth_header",
        )
        return kwargs

    def get_issue(self, repo, issue_id):
        return self.get(u"/1.0/repositories/%s/issues/%s" % (repo, issue_id))

    def create_issue(self, repo, data):
        data = {
            "title": data["title"],
            "content": data["description"],
            "kind": data["issue_type"],
            "priority": data["priority"],
        }
        return self.post(u"/1.0/repositories/{}/issues".format(repo), data=data, json=False)

    def search_issues(self, repo, query):
        return self.get(u"/1.0/repositories/{}/issues".format(repo), params={"search": query})

    def create_comment(self, repo, issue_id, data):
        return self.post(
            u"/1.0/repositories/%s/issues/%s/comments" % (repo, issue_id), data=data, json=False
        )

    def get_repo(self, repo):
        return self.get(u"/2.0/repositories/{}".format(repo))

    def create_hook(self, repo, data):
        return self.post(u"/2.0/repositories/{}/hooks".format(repo), data=data)

    def delete_hook(self, repo, id):
        return self.delete(u"/2.0/repositories/{}/hooks/{}".format(repo, id))

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
        # returns unidiff file

        resp = self.get(u"/2.0/repositories/{}/diff/{}".format(repo, sha), allow_text=True)

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
        data = self.get(u"/2.0/repositories/{}/commits/{}".format(repo, end_sha))

        return self.zip_commit_data(repo, data["values"])

    def compare_commits(self, repo, start_sha, end_sha):
        # where start_sha is oldest and end_sha is most recent
        # see
        # https://developer.atlassian.com/bitbucket/api/2/reference/resource/repositories/%7Busername%7D/%7Brepo_slug%7D/commits/%7Brevision%7D
        commits = []
        done = False

        url = u"/2.0/repositories/{}/commits/{}".format(repo, end_sha)

        while not done and len(commits) < 90:
            data = self.get(url)

            for commit in data["values"]:
                if commit["hash"].startswith(start_sha):
                    done = True
                    break
                commits.append(commit)

            # move page forward
            try:
                url = data["next"]
            except KeyError:
                break

        return self.zip_commit_data(repo, commits)
