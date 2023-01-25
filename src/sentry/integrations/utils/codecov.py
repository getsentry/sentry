from typing import Optional, Sequence, Tuple

import requests
from sentry_sdk import configure_scope

from sentry import options

LineCoverage = Sequence[Tuple[int, int]]
CODECOV_URL = "https://api.codecov.io/api/v2/{service}/{owner_username}/repos/{repo_name}/report"


def get_codecov_data(
    repo: str, service: str, branch: str, path: str
) -> Tuple[Optional[LineCoverage], Optional[str]]:
    codecov_token = options.get("codecov.client-secret")
    line_coverage = None
    codecov_url = None
    if codecov_token:
        owner_username, repo_name = repo.split("/")
        if service == "github":
            service = "gh"
        path = path.lstrip("/")
        url = CODECOV_URL.format(
            service=service, owner_username=owner_username, repo_name=repo_name
        )
        with configure_scope() as scope:
            params = {"branch": branch, "path": path}
            response = requests.get(
                url, params=params, headers={"Authorization": f"Bearer {codecov_token}"}
            )
            scope.set_tag("codecov.http_code", response.status_code)

            response.raise_for_status()
            line_coverage = response.json()["files"][0]["line_coverage"]
            codecov_url = response.json()["commit_file_url"]

            coverage_found = line_coverage is not None and len(line_coverage) > 0
            scope.set_tag("codecov.coverage_found", coverage_found)
            scope.set_tag("codecov.url", codecov_url)

    return line_coverage, codecov_url
