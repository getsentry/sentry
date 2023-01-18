from typing import Any

import requests

from sentry import options

CODECOV_URL = "https://api.codecov.io/api/v2/{service}/{owner_username}/repos/{repo_name}/report"


def get_codecov_line_coverage(repo: str, service: str, branch: str, path: str) -> Any:
    CODECOV_TOKEN = options.get("codecov.client-secret")
    owner_username, repo_name = repo.split("/")
    if service == "github":
        service = "gh"
    url = CODECOV_URL.format(service=service, owner_username=owner_username, repo_name=repo_name)
    params = {"branch": branch, "path": path}
    response = requests.get(
        url, params=params, headers={"Authorization": f"tokenAuth {CODECOV_TOKEN}"}
    )
    response.raise_for_status()

    return response.json()["files"][0]["line_coverage"]
