from typing import Literal, Optional, Sequence, Tuple

import requests
from sentry_sdk import configure_scope

from sentry import options

LineCoverage = Sequence[Tuple[int, int]]
CODECOV_URL = "https://api.codecov.io/api/v2/{service}/{owner_username}/repos/{repo_name}/report"
REF_TYPE = Literal["branch", "sha"]


def get_codecov_data(
    repo: str, service: str, ref: str, ref_type: REF_TYPE, path: str, has_error_commit: bool
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
            params = {ref_type: ref, "path": path}
            response = requests.get(
                url, params=params, headers={"Authorization": f"Bearer {codecov_token}"}
            )
            tags = {
                "codecov.request_url": url,
                "codecov.request_path": path,
                "codecov.request_ref": ref,
                "codecov.http_code": response.status_code,
                "codecov.ref_source": "from_release" if has_error_commit else "from_git_blame",
            }

            response_json = response.json()
            files = response_json.get("files")
            line_coverage = files[0].get("line_coverage") if files else None

            coverage_found = line_coverage not in [None, [], [[]]]
            tags["codecov.coverage_found"] = coverage_found

            codecov_url = response_json.get("commit_file_url", "")
            tags["codecov.coverage_url"] = codecov_url
            for key, value in tags.items():
                scope.set_tag(key, value)

            response.raise_for_status()

    return line_coverage, codecov_url
