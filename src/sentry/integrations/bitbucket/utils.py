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
    filehistory = "/2.0/repositories/{repo}/filehistory/{sha}/{path}"
