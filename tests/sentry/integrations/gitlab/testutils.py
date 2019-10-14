from __future__ import absolute_import

from sentry.testutils import APITestCase
from time import time
from sentry.models import Identity, IdentityProvider, Integration, Repository


EXTERNAL_ID = "example.gitlab.com:group-x"
WEBHOOK_SECRET = "secret-token-value"
WEBHOOK_TOKEN = u"{}:{}".format(EXTERNAL_ID, WEBHOOK_SECRET)


class GitLabTestCase(APITestCase):
    provider = "gitlab"

    def setUp(self):
        self.login_as(self.user)
        self.integration = Integration.objects.create(
            provider=self.provider,
            name="Example Gitlab",
            external_id=EXTERNAL_ID,
            metadata={
                "instance": "example.gitlab.com",
                "base_url": "https://example.gitlab.com",
                "domain_name": "example.gitlab.com/group-x",
                "verify_ssl": False,
                "webhook_secret": WEBHOOK_SECRET,
                "group_id": 1,
            },
        )
        identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(type=self.provider, config={}),
            user=self.user,
            external_id="gitlab123",
            data={"access_token": "123456789", "created_at": time(), "refresh_token": "0987654321"},
        )
        self.integration.add_organization(self.organization, self.user, identity.id)
        self.installation = self.integration.get_installation(self.organization.id)

    def create_repo(self, name, external_id=15, url=None, organization_id=None):
        instance = self.integration.metadata["instance"]
        organization_id = organization_id or self.organization.id
        return Repository.objects.create(
            organization_id=organization_id,
            name=name,
            external_id=u"{}:{}".format(instance, external_id),
            url=url,
            config={"project_id": external_id},
            provider="integrations:gitlab",
            integration_id=self.integration.id,
        )


MERGE_REQUEST_OPENED_EVENT = b"""{
  "object_kind": "merge_request",
  "user": {
    "name": "Administrator",
    "username": "root",
    "avatar_url": "http://www.gravatar.com/avatar/e64c7d89f26bd1972efa854d13d7dd61?s=80&d=identicon"
  },
  "project": {
    "id": 15,
    "name": "Sentry",
    "description": "",
    "web_url": "http://example.com/cool-group/sentry",
    "avatar_url": null,
    "git_ssh_url": "git@example.com:cool-group/sentry.git",
    "git_http_url": "http://example.com/cool-group/sentry.git",
    "namespace": "cool-group",
    "visibility_level": 0,
    "path_with_namespace": "cool-group/sentry",
    "default_branch": "master",
    "ci_config_path": "",
    "homepage": "http://example.com/cool-group/sentry",
    "url": "git@example.com:cool-group/sentry.git",
    "ssh_url": "git@example.com:cool-group/sentry.git",
    "http_url": "http://example.com/cool-group/sentry.git"
  },
  "object_attributes": {
    "id": 90,
    "target_branch": "master",
    "source_branch": "ms-viewport",
    "source_project_id": 14,
    "author_id": 51,
    "assignee_id": 6,
    "title": "Create a new Viewport",
    "created_at": "2017-09-20T08:31:45.944Z",
    "updated_at": "2017-09-28T12:23:42.365Z",
    "milestone_id": null,
    "state": "opened",
    "merge_status": "unchecked",
    "target_project_id": 14,
    "iid": 1,
    "description": "Create a viewport for things Fixes BAR-9",
    "updated_by_id": 1,
    "merge_error": null,
    "merge_params": {
      "force_remove_source_branch": "0"
    },
    "merge_when_pipeline_succeeds": false,
    "merge_user_id": null,
    "merge_commit_sha": null,
    "deleted_at": null,
    "in_progress_merge_commit_sha": null,
    "lock_version": 5,
    "time_estimate": 0,
    "last_edited_at": "2017-09-27T12:43:37.558Z",
    "last_edited_by_id": 1,
    "head_pipeline_id": 61,
    "ref_fetched": true,
    "merge_jid": null,
    "source": {
      "name": "Awesome Project",
      "description": "",
      "web_url": "http://example.com/awesome_space/awesome_project",
      "avatar_url": null,
      "git_ssh_url": "git@example.com:awesome_space/awesome_project.git",
      "git_http_url": "http://example.com/awesome_space/awesome_project.git",
      "namespace": "root",
      "visibility_level": 0,
      "path_with_namespace": "awesome_space/awesome_project",
      "default_branch": "master",
      "ci_config_path": "",
      "homepage": "http://example.com/awesome_space/awesome_project",
      "url": "http://example.com/awesome_space/awesome_project.git",
      "ssh_url": "git@example.com:awesome_space/awesome_project.git",
      "http_url": "http://example.com/awesome_space/awesome_project.git"
    },
    "target": {
      "name": "Awesome Project",
      "description": "Aut reprehenderit ut est.",
      "web_url": "http://example.com/awesome_space/awesome_project",
      "avatar_url": null,
      "git_ssh_url": "git@example.com:awesome_space/awesome_project.git",
      "git_http_url": "http://example.com/awesome_space/awesome_project.git",
      "namespace": "Awesome Space",
      "visibility_level": 0,
      "path_with_namespace": "awesome_space/awesome_project",
      "default_branch": "master",
      "ci_config_path": "",
      "homepage": "http://example.com/awesome_space/awesome_project",
      "url": "http://example.com/awesome_space/awesome_project.git",
      "ssh_url": "git@example.com:awesome_space/awesome_project.git",
      "http_url": "http://example.com/awesome_space/awesome_project.git"
    },
    "last_commit": {
      "id": "ba3e0d8ff79c80d5b0bbb4f3e2e343e0aaa662b7",
      "message": "fixed readme",
      "timestamp": "2017-09-26T16:12:57Z",
      "url": "http://example.com/awesome_space/awesome_project/commits/da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
      "author": {
        "name": "GitLab dev user",
        "email": "gitlabdev@dv6700.(none)"
      }
    },
    "work_in_progress": false,
    "total_time_spent": 0,
    "human_total_time_spent": null,
    "human_time_estimate": null
  },
  "labels": null,
  "repository": {
    "name": "git-gpg-test",
    "url": "git@example.com:awesome_space/awesome_project.git",
    "description": "",
    "homepage": "http://example.com/awesome_space/awesome_project"
  }
}"""


PUSH_EVENT = b"""
{
  "object_kind": "push",
  "before": "95790bf891e76fee5e1747ab589903a6a1f80f22",
  "after": "da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
  "ref": "refs/heads/master",
  "checkout_sha": "da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
  "user_id": 4,
  "user_name": "John Smith",
  "user_username": "jsmith",
  "user_email": "john@example.com",
  "user_avatar": "https://s.gravatar.com/avatar/d4c74594d841139328695756648b6bd6?s=8://s.gravatar.com/avatar/d4c74594d841139328695756648b6bd6?s=80",
  "project_id": 15,
  "project":{
    "id": 15,
    "name":"Sentry",
    "description":"",
    "web_url":"http://example.com/cool-group/sentry",
    "avatar_url":null,
    "git_ssh_url":"git@example.com:cool-group/sentry.git",
    "git_http_url":"http://example.com/cool-group/sentry.git",
    "namespace":"Cool Group",
    "visibility_level":0,
    "path_with_namespace":"cool-group/sentry",
    "default_branch":"master",
    "homepage":"http://example.com/cool-group/sentry",
    "url":"git@example.com:cool-group/sentry.git",
    "ssh_url":"git@example.com:cool-group/sentry.git",
    "http_url":"http://example.com/cool-group/sentry.git"
  },
  "repository":{
    "name": "Sentry",
    "url": "git@example.com:cool-group/sentry.git",
    "description": "",
    "homepage": "http://example.com/cool-group/sentry",
    "git_http_url":"http://example.com/cool-group/sentry.git",
    "git_ssh_url":"git@example.com:cool-group/sentry.git",
    "visibility_level":0
  },
  "commits": [
    {
      "id": "b6568db1bc1dcd7f8b4d5a946b0b91f9dacd7327",
      "message": "Update Catalan translation to e38cb41.",
      "timestamp": "2011-12-12T14:27:31+02:00",
      "url": "http://example.com/cool-group/sentry/commit/b6568db1bc1dcd7f8b4d5a946b0b91f9dacd7327",
      "author": {
        "name": "Jordi",
        "email": "jordi@example.org"
      },
      "added": ["CHANGELOG"],
      "modified": ["app/controller/application.rb"],
      "removed": []
    },
    {
      "id": "da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
      "message": "fixed readme",
      "timestamp": "2012-01-03T23:36:29+02:00",
      "url": "http://example.com/cool-group/sentry/commit/da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
      "author": {
        "name": "GitLab dev user",
        "email": "gitlabdev@example.org"
      },
      "added": ["CHANGELOG"],
      "modified": ["app/controller/application.rb"],
      "removed": []
    }
  ],
  "total_commits_count": 2
}
"""

PUSH_EVENT_IGNORED_COMMIT = b"""
{
  "object_kind": "push",
  "before": "95790bf891e76fee5e1747ab589903a6a1f80f22",
  "after": "da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
  "ref": "refs/heads/master",
  "checkout_sha": "da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
  "user_id": 4,
  "user_name": "John Smith",
  "user_username": "jsmith",
  "user_email": "john@example.com",
  "user_avatar": "https://s.gravatar.com/avatar/d4c74594d841139328695756648b6bd6?s=8://s.gravatar.com/avatar/d4c74594d841139328695756648b6bd6?s=80",
  "project_id": 15,
  "project":{
    "id": 15,
    "name":"Sentry",
    "description":"",
    "web_url":"http://example.com/cool-group/sentry",
    "avatar_url":null,
    "git_ssh_url":"git@example.com:cool-group/sentry.git",
    "git_http_url":"http://example.com/cool-group/sentry.git",
    "namespace":"cool-group",
    "visibility_level":0,
    "path_with_namespace":"cool-group/sentry",
    "default_branch":"master",
    "homepage":"http://example.com/cool-group/sentry",
    "url":"git@example.com:cool-group/sentry.git",
    "ssh_url":"git@example.com:cool-group/sentry.git",
    "http_url":"http://example.com/cool-group/sentry.git"
  },
  "repository":{
    "name": "Sentry",
    "url": "git@example.com:cool-group/sentry.git",
    "description": "",
    "homepage": "http://example.com/cool-group/sentry",
    "git_http_url":"http://example.com/cool-group/sentry.git",
    "git_ssh_url":"git@example.com:cool-group/sentry.git",
    "visibility_level":0
  },
  "commits": [
    {
      "id": "b6568db1bc1dcd7f8b4d5a946b0b91f9dacd7327",
      "message": "Update things #skipsentry",
      "timestamp": "2011-12-12T14:27:31+02:00",
      "url": "http://example.com/cool-group/sentry/commit/b6568db1bc1dcd7f8b4d5a946b0b91f9dacd7327",
      "author": {
        "name": "Jordi",
        "email": "jordi@example.org"
      },
      "added": ["CHANGELOG"],
      "modified": ["app/controller/application.rb"],
      "removed": []
    }
  ],
  "total_commits_count": 1
}
"""


COMPARE_RESPONSE = r"""
{
  "commit": {
    "id": "12d65c8dd2b2676fa3ac47d955accc085a37a9c1",
    "short_id": "12d65c8dd2b",
    "title": "JS fix",
    "author_name": "Dmitriy",
    "author_email": "dmitriy@example.com",
    "created_at": "2014-02-27T10:27:00+02:00"
  },
  "commits": [{
    "id": "12d65c8dd2b2676fa3ac47d955accc085a37a9c1",
    "short_id": "12d65c8dd2b",
    "title": "JS fix",
    "author_name": "Dmitriy",
    "author_email": "dmitriy@example.com",
    "created_at": "2014-02-27T10:27:00+02:00"
  },
  {
    "id": "8b090c1b79a14f2bd9e8a738f717824ff53aebad",
    "short_id": "8b090c1b",
    "title": "Fix dmitriy mistake",
    "author_name": "Sally",
    "author_email": "sally@example.com",
    "created_at": "2014-02-27T10:27:00+02:00"
  }],
  "diffs": [{
    "old_path": "files/js/application.js",
    "new_path": "files/js/application.js",
    "a_mode": null,
    "b_mode": "100644",
    "diff": "--- a/files/js/application.js\n+++ b/files/js/application.js\n@@ -24,8 +24,10 @@\n //= require g.raphael-min\n //= require g.bar-min\n //= require branch-graph\n-//= require highlightjs.min\n-//= require ace/ace\n //= require_tree .\n //= require d3\n //= require underscore\n+\n+function fix() { \n+  alert(\"Fixed\")\n+}",
    "new_file": false,
    "renamed_file": false,
    "deleted_file": false
  }],
  "compare_timeout": false,
  "compare_same_ref": false
}
"""


COMMIT_LIST_RESPONSE = r"""
[
  {
    "id": "ed899a2f4b50b4370feeea94676502b42383c746",
    "short_id": "ed899a2f4b5",
    "title": "Replace sanitize with escape once",
    "author_name": "Dmitriy",
    "author_email": "dmitriy@example.com",
    "authored_date": "2018-09-20T11:50:22+03:00",
    "committer_name": "Administrator",
    "committer_email": "admin@example.com",
    "committed_date": "2018-09-20T11:50:22+03:00",
    "created_at": "2018-09-20T11:50:22+03:00",
    "message": "Replace sanitize with escape once",
    "parent_ids": [
      "6104942438c14ec7bd21c6cd5bd995272b3faff6"
    ]
  },
  {
    "id": "6104942438c14ec7bd21c6cd5bd995272b3faff6",
    "short_id": "6104942438c",
    "title": "Sanitize for network graph",
    "author_name": "randx",
    "author_email": "dmitriy@example.com",
    "committer_name": "Dmitriy",
    "committer_email": "dmitriy@example.com",
    "created_at": "2018-09-20T09:06:12+03:00",
    "message": "Sanitize for network graph",
    "parent_ids": [
      "ae1d9fb46aa2b07ee9836d49862ec4e2c46fbbba"
    ]
  }
]
"""

COMMIT_DIFF_RESPONSE = r"""
[
    {
        "old_path": "files/js/application.js",
        "new_path": "files/js/application.js",
        "a_mode": null,
        "b_mode": "100644",
        "diff": "--- a/files/js/application.js\n+++ b/files/js/application.js\n@@ -24,8 +24,10 @@\n //= require g.raphael-min\n //= require g.bar-min\n //= require branch-graph\n-//= require highlightjs.min\n-//= require ace/ace\n //= require_tree .\n //= require d3\n //= require underscore\n+\n+function fix() { \n+  alert(\"Fixed\")\n+}",
        "new_file": false,
        "renamed_file": false,
        "deleted_file": false
    },
    {
        "a_mode": "100644",
        "b_mode": "100644",
        "deleted_file": false,
        "diff": "@@ -1 +1,3 @@\n OH HAI\n+OH HAI\n+OH HAI\n",
        "new_file": false,
        "new_path": "README.txt",
        "old_path": "README.txt",
        "renamed_file": false
    }
]
"""
