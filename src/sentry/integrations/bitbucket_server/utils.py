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
    repository_commit = "/rest/api/1.0/projects/{project}/repos/{repo}/commits/{commit}"
    commit_changes = "/rest/api/1.0/projects/{project}/repos/{repo}/commits/{commit}/changes"
    raw = "/projects/{project}/repos/{repo}/raw/{path}?at={sha}"
    source = "/rest/api/1.0/projects/{project}/repos/{repo}/browse/{path}?at={sha}"

    @staticmethod
    def get_browse(
        project: str,
        repo: str,
        path: str,
        sha: str | None,
        blame: bool = False,
        no_content: bool = False,
    ) -> str:
        project = quote(project)
        repo = quote(repo)

        params = {}
        if sha:
            params["at"] = sha
        if blame:
            params["blame"] = "true"
        if no_content:
            params["noContent"] = "true"

        return f"/rest/api/1.0/projects/{project}/repos/{repo}/browse/{path}?{urlencode(params)}"
