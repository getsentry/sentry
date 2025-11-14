from typing import int
from urllib.parse import quote, urlencode


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

    @staticmethod
    def build_raw(project: str, repo: str, path: str, sha: str | None) -> str:
        project = quote(project)
        repo = quote(repo)

        params = {}
        if sha:
            params["at"] = sha

        return f"/projects/{project}/repos/{repo}/raw/{path}?{urlencode(params)}"

    @staticmethod
    def build_source(project: str, repo: str, path: str, sha: str | None) -> str:
        project = quote(project)
        repo = quote(repo)

        params = {}
        if sha:
            params["at"] = sha

        return f"/rest/api/1.0/projects/{project}/repos/{repo}/browse/{path}?{urlencode(params)}"
