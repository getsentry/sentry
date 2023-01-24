from typing import Optional, Sequence, Tuple

import requests
from sentry_sdk import configure_scope

from sentry import options

CODECOV_URL = "https://api.codecov.io/api/v2/{service}/{owner_username}/repos/{repo_name}/report"


def get_codecov_data(
    repo: str, service: str, branch: str, path: str
) -> Tuple[Optional[Sequence[Tuple[int, int]]], Optional[str]]:
    codecov_token = options.get("codecov.client-secret")
    line_coverage = None
    codecov_url = None
    if codecov_token:
        owner_username, repo_name = repo.split("/")
        if service == "github":
            service = "gh"
        url = CODECOV_URL.format(
            service=service, owner_username=owner_username, repo_name=repo_name
        )
        with configure_scope() as scope:
            scope.set_tag("codecov.attempted_url", url)
            params = {"branch": branch, "path": path}
            response = requests.get(
                url, params=params, headers={"Authorization": f"tokenAuth {codecov_token}"}
            )
            response.raise_for_status()
            line_coverage = response.json()["files"][0]["line_coverage"]
            codecov_url = response.json()["commit_file_url"]

    return line_coverage, codecov_url
