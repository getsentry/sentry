from __future__ import annotations

from urllib.parse import quote

from django.urls import reverse

from sentry.integrations.client import ApiClient
from sentry.models import Repository
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized
from sentry.utils.http import absolute_uri

API_VERSION = "/api/v4"


class GitLabApiClientPath:
    oauth_token = "/oauth/token"
    commit = "/projects/{project}/repository/commits/{sha}"
    commits = "/projects/{project}/repository/commits"
    compare = "/projects/{project}/repository/compare"
    diff = "/projects/{project}/repository/commits/{sha}/diff"
    file = "/projects/{project}/repository/files/{path}"
    group = "/groups/{group}"
    group_projects = "/groups/{group}/projects"
    hooks = "/hooks"
    issue = "/projects/{project}/issues/{issue}"
    issues = "/projects/{project}/issues"
    notes = "/projects/{project}/issues/{issue_id}/notes"
    project = "/projects/{project}"
    project_issues = "/projects/{project}/issues"
    project_hooks = "/projects/{project}/hooks"
    project_hook = "/projects/{project}/hooks/{hook_id}"
    project_search = "/projects/{project}/search"
    projects = "/projects"
    user = "/user"

    @staticmethod
    def build_api_url(base_url, path):
        return f"{base_url}{API_VERSION}{path}"


class GitLabSetupClient(ApiClient):
    """
    API Client that doesn't require an installation.
    This client is used during integration setup to fetch data
    needed to build installation metadata
    """

    integration_name = "gitlab_setup"

    def __init__(self, base_url, access_token, verify_ssl):
        super().__init__(verify_ssl)
        self.base_url = base_url
        self.token = access_token

    def get_group(self, group):
        """Get a group based on `path` which is a slug.

        We need to URL quote because subgroups use `/` in their
        `id` and GitLab requires slugs to be URL encoded.
        """
        group = quote(group, safe="")
        path = GitLabApiClientPath.group.format(group=group)
        return self.get(path)

    def request(self, method, path, data=None, params=None):
        headers = {"Authorization": f"Bearer {self.token}"}
        return self._request(
            method,
            GitLabApiClientPath.build_api_url(self.base_url, path),
            headers=headers,
            data=data,
            params=params,
        )


class GitLabApiClient(ApiClient):
    integration_name = "gitlab"

    def __init__(self, installation):
        self.installation = installation
        verify_ssl = self.metadata["verify_ssl"]
        self.is_refreshing_token = False
        super().__init__(verify_ssl)

    @property
    def identity(self):
        return self.installation.default_identity

    @property
    def metadata(self):
        return self.installation.model.metadata

    def request_headers(self, identity):
        access_token = identity.data["access_token"]
        return {"Authorization": f"Bearer {access_token}"}

    def request(self, method, path, data=None, params=None):
        headers = self.request_headers(self.identity)
        url = GitLabApiClientPath.build_api_url(self.metadata["base_url"], path)
        try:
            return self._request(method, url, headers=headers, data=data, params=params)
        except ApiUnauthorized as e:
            if self.is_refreshing_token:
                raise e
            self.is_refreshing_token = True
            new_identity = self.refresh_auth()
            resp = self._request(
                method,
                url,
                headers=self.request_headers(new_identity),
                data=data,
                params=params,
            )
            self.is_refreshing_token = False
            return resp

    def refresh_auth(self):
        """
        Modeled after Doorkeeper's docs
        where Doorkeeper is a dependency for GitLab that handles OAuth

        https://github.com/doorkeeper-gem/doorkeeper/wiki/Enable-Refresh-Token-Credentials#testing-with-oauth2-gem
        """
        return self.identity.get_provider().refresh_identity(
            self.identity,
            refresh_token_url="{}{}".format(
                self.metadata["base_url"], GitLabApiClientPath.oauth_token
            ),
        )

    def get_user(self):
        """Get a user

        See https://docs.gitlab.com/ee/api/users.html#single-user
        """
        return self.get(GitLabApiClientPath.user)

    def search_projects(self, group=None, query=None, simple=True):
        """Get projects

        See https://docs.gitlab.com/ee/api/groups.html#list-a-group-s-projects
        and https://docs.gitlab.com/ee/api/projects.html#list-all-projects
        """

        def gen_params(page_number, page_size):
            # Simple param returns limited fields for the project.
            # Really useful, because we often don't need most of the project information
            params = {
                "search": query,
                "simple": simple,
                "order_by": "last_activity_at",
                "page": page_number + 1,  # page starts at 1
                "per_page": page_size,
            }
            if group:
                extra_params = {"include_subgroups": self.metadata.get("include_subgroups", False)}
            else:
                extra_params = {"membership": True}

            params.update(extra_params)
            return params

        def get_results(resp):
            return resp

        if group:
            path = GitLabApiClientPath.group_projects.format(group=group)
        else:
            path = GitLabApiClientPath.projects

        return self.get_with_pagination(path, gen_params, get_results)

    def get_project(self, project_id):
        """Get project

        See https://docs.gitlab.com/ee/api/projects.html#get-single-project
        """
        return self.get(GitLabApiClientPath.project.format(project=project_id))

    def get_issue(self, project_id, issue_id):
        """Get an issue

        See https://docs.gitlab.com/ee/api/issues.html#single-issue
        """
        try:
            return self.get(GitLabApiClientPath.issue.format(project=project_id, issue=issue_id))
        except IndexError:
            raise ApiError("Issue not found with ID", 404)

    def create_issue(self, project, data):
        """Create an issue

        See https://docs.gitlab.com/ee/api/issues.html#new-issue
        """
        return self.post(GitLabApiClientPath.issues.format(project=project), data=data)

    def create_issue_comment(self, project_id, issue_id, data):
        """Create an issue note/comment

        See https://docs.gitlab.com/ee/api/notes.html#create-new-issue-note
        """
        return self.post(
            GitLabApiClientPath.notes.format(project=project_id, issue_id=issue_id), data=data
        )

    def search_project_issues(self, project_id, query, iids=None):
        """Search issues in a project

        See https://docs.gitlab.com/ee/api/issues.html#list-project-issues
        """
        path = GitLabApiClientPath.project_issues.format(project=project_id)

        return self.get(path, params={"scope": "all", "search": query, "iids": iids})

    def create_project_webhook(self, project_id):
        """Create a webhook on a project

        See https://docs.gitlab.com/ee/api/projects.html#add-project-hook
        """
        path = GitLabApiClientPath.project_hooks.format(project=project_id)
        hook_uri = reverse("sentry-extensions-gitlab-webhook")
        model = self.installation.model
        data = {
            "url": absolute_uri(hook_uri),
            "token": "{}:{}".format(model.external_id, model.metadata["webhook_secret"]),
            "merge_requests_events": True,
            "push_events": True,
            "enable_ssl_verification": model.metadata["verify_ssl"],
        }
        resp = self.post(path, data)

        return resp["id"]

    def delete_project_webhook(self, project_id, hook_id):
        """Delete a webhook from a project

        See https://docs.gitlab.com/ee/api/projects.html#delete-project-hook
        """
        path = GitLabApiClientPath.project_hook.format(project=project_id, hook_id=hook_id)
        return self.delete(path)

    def get_last_commits(self, project_id, end_sha):
        """Get the last set of commits ending at end_sha

        Gitlab doesn't give us a good way to do this, so we fetch the end_sha
        and use its date to find the block of commits. We only fetch one page
        of commits to match other implementations (github, bitbucket)

        See https://docs.gitlab.com/ee/api/commits.html#get-a-single-commit and
        https://docs.gitlab.com/ee/api/commits.html#list-repository-commits
        """
        path = GitLabApiClientPath.commit.format(project=project_id, sha=end_sha)
        commit = self.get(path)
        if not commit:
            return []
        end_date = commit["created_at"]

        path = GitLabApiClientPath.commits.format(project=project_id)
        return self.get(path, params={"until": end_date})

    def compare_commits(self, project_id, start_sha, end_sha):
        """Compare commits between two SHAs

        See https://docs.gitlab.com/ee/api/repositories.html#compare-branches-tags-or-commits
        """
        path = GitLabApiClientPath.compare.format(project=project_id)
        return self.get(path, params={"from": start_sha, "to": end_sha})

    def get_diff(self, project_id, sha):
        """Get the diff for a commit

        See https://docs.gitlab.com/ee/api/commits.html#get-the-diff-of-a-commit
        """
        path = GitLabApiClientPath.diff.format(project=project_id, sha=sha)
        return self.get(path)

    def check_file(self, repo: Repository, path: str, ref: str) -> str | None:
        """Fetch a file for stacktrace linking

        See https://docs.gitlab.com/ee/api/repository_files.html#get-file-from-repository
        Path requires file path and ref
        file_path must also be URL encoded Ex. lib%2Fclass%2Erb
        """
        try:
            self.base_url = self.metadata["base_url"]
            project_id = repo.config["project_id"]
            encoded_path = quote(path, safe="")

            request_path = GitLabApiClientPath.file.format(project=project_id, path=encoded_path)
            return self.head_cached(request_path, params={"ref": ref})
        except ApiError as e:
            # Gitlab can return 404 or 400 if the file doesn't exist
            if e.code != 400:
                raise
            return None

    def get_file(self, repo: Repository, path: str, ref: str) -> bytes:
        """Get the contents of a file

        See https://docs.gitlab.com/ee/api/repository_files.html#get-file-from-repository
        Path requires file path and ref
        file_path must also be URL encoded Ex. lib%2Fclass%2Erb
        """
        from base64 import b64decode

        project_id = repo.config["project_id"]
        encoded_path = quote(path, safe="")
        request_path = GitLabApiClientPath.file.format(project=project_id, path=encoded_path)
        contents = self.get(request_path, params={"ref": ref})

        encoded_content = contents["content"]
        return b64decode(encoded_content)
