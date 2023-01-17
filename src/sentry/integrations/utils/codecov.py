from typing import Optional, Sequence, Tuple

import requests

from sentry import options

CODECOV_URL = "https://api.codecov.io/api/v2/{service}/{owner_username}/repos/{repo_name}/report"
CODECOV_TOKEN = options.get("codecov.client-secret")


class Codecov:
    def get_codecov_line_coverage(
        repo: str, service: str, branch: str, path: str
    ) -> Tuple[Optional[Sequence[Tuple[int, int]]], Optional[int]]:
        owner_username, repo_name = repo.split("/")
        if service == "github":
            service = "gh"
        url = CODECOV_URL.format(
            service=service, owner_username=owner_username, repo_name=repo_name
        )
        line_coverage, status_code = None, None
        params = {"branch": branch, "path": path}
        response = requests.get(
            url, params=params, headers={"Authorization": f"tokenAuth {CODECOV_TOKEN}"}
        )
        line_coverage, status_code = (
            response.json()["files"][0]["line_coverage"],
            response.status_code,
        )

        return line_coverage, status_code
