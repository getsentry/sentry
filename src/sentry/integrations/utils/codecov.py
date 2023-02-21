from __future__ import annotations

from enum import Enum
from typing import Literal, Optional, Sequence, Tuple

import requests
from sentry_sdk import configure_scope

from sentry import options
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization

LineCoverage = Sequence[Tuple[int, int]]
CODECOV_REPORT_URL = (
    "https://api.codecov.io/api/v2/{service}/{owner_username}/repos/{repo_name}/report"
)
CODECOV_REPOS_URL = "https://api.codecov.io/api/v2/{service}/{owner_username}/repos"
REF_TYPE = Literal["branch", "sha"]
CODECOV_TIMEOUT = 2


class CodecovIntegrationError(Enum):
    MISSING_TOKEN = "Internal Error"
    MISSING_GH = "Codecov access can only be enabled if the organization has a GitHub integration."
    MISSING_CODECOV = (
        "Codecov access can only be enabled if the organization has a Codecov integration."
    )


def has_codecov_integration(organization: Organization) -> Tuple[bool, str | None]:
    """
    Checks if the organization has a Codecov integration.

    Returns a tuple of (has_codecov_integration, error_message)
    """
    codecov_token = options.get("codecov.client-secret")
    if not codecov_token:
        return False, CodecovIntegrationError.MISSING_TOKEN.value

    integrations = Integration.objects.filter(organizations=organization.id, provider="github")
    if not integrations.exists():
        return False, CodecovIntegrationError.MISSING_GH.value

    for integration in integrations:
        integration_installation = integration.get_installation(organization.id)
        if not integration_installation:
            continue

        repos = integration_installation.get_client().get_repositories()
        if not repos:
            continue

        owner_username, _ = repos[0].split("/")
        url = CODECOV_REPOS_URL.format(service="gh", owner_username=owner_username)
        response = requests.get(url, headers={"Authorization": f"Bearer {codecov_token}"})
        if response.status_code == 404:
            continue
        response.raise_for_status()

        return True, None  # We found a codecov integration, so we can stop looking

    # None of the Github Integrations had a Codecov integration
    return (
        False,
        CodecovIntegrationError.MISSING_CODECOV.value,
    )


def get_codecov_data(
    repo: str,
    service: str,
    ref: str,
    ref_type: REF_TYPE,
    path: str,
    set_timeout: bool,
) -> Tuple[Optional[LineCoverage], Optional[str]]:
    codecov_token = options.get("codecov.client-secret")
    line_coverage = None
    codecov_url = None
    if codecov_token:
        owner_username, repo_name = repo.split("/")
        if service == "github":
            service = "gh"
        path = path.lstrip("/")
        url = CODECOV_REPORT_URL.format(
            service=service, owner_username=owner_username, repo_name=repo_name
        )
        with configure_scope() as scope:
            params = {ref_type: ref, "path": path}
            response = requests.get(
                url,
                params=params,
                headers={"Authorization": f"Bearer {codecov_token}"},
                timeout=CODECOV_TIMEOUT if set_timeout else None,
            )
            tags = {
                "codecov.request_url": url,
                "codecov.request_path": path,
                "codecov.request_ref": ref,
                "codecov.http_code": response.status_code,
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
