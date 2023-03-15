from __future__ import annotations

from enum import Enum
from typing import Any, Dict, Optional, Sequence, Tuple

import requests
from rest_framework import status
from sentry_sdk import configure_scope

from sentry import features, options
from sentry.models.integrations.integration import Integration
from sentry.models.organization import Organization

LineCoverage = Sequence[Tuple[int, int]]
CODECOV_REPORT_URL = (
    "https://api.codecov.io/api/v2/{service}/{owner_username}/repos/{repo_name}/file_report/{path}"
)
CODECOV_REPOS_URL = "https://api.codecov.io/api/v2/{service}/{owner_username}/repos"
CODECOV_TIMEOUT = 2


class CodecovIntegrationError(Enum):
    MISSING_TOKEN = "Internal Error"
    MISSING_GH = "Codecov access can only be enabled if the organization has a GitHub integration."
    MISSING_CODECOV = (
        "Codecov access can only be enabled if the organization has a Codecov integration."
    )


def codecov_enabled(organization: Organization, user: Any) -> bool:
    flag_enabled = features.has(
        "organizations:codecov-stacktrace-integration", organization, actor=user
    )
    setting_enabled = organization.flags.codecov_access
    return bool(flag_enabled and setting_enabled)


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

        repositories = integration_installation.get_client().get_repositories()
        if not repositories:
            continue

        repos = repositories.get("repositories", None)
        if not repos:
            continue

        owner_username, _ = repos[0].get("full_name").split("/")
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


def get_codecov_data(repo: str, service: str, path: str) -> Tuple[LineCoverage | None, str | None]:
    codecov_token = options.get("codecov.client-secret")
    if not codecov_token:
        return None, None

    owner_username, repo_name = repo.split("/")
    service = "gh" if service == "github" else service

    path = path.lstrip("/")
    url = CODECOV_REPORT_URL.format(
        service=service,
        owner_username=owner_username,
        repo_name=repo_name,
        path=path,
    )

    line_coverage, codecov_url = None, None
    with configure_scope() as scope:
        response = requests.get(
            url,
            params={"walk_back": 10},
            headers={"Authorization": f"Bearer {codecov_token}"},
            timeout=CODECOV_TIMEOUT,
        )
        tags = {
            "codecov.request_url": url,
            "codecov.request_path": path,
            "codecov.http_code": response.status_code,
        }

        response_json = response.json()

        tags["codecov.new_endpoint"] = True
        line_coverage = response_json.get("line_coverage")

        coverage_found = line_coverage not in [None, [], [[]]]
        codecov_url = response_json.get("commit_file_url", "")
        tags.update(
            {
                "codecov.coverage_found": coverage_found,
                "codecov.coverage_url": codecov_url,
            },
        )

        for key, value in tags.items():
            scope.set_tag(key, value)

        response.raise_for_status()

    return line_coverage, codecov_url


def fetch_codecov_data(config: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        repo = config["repository"].name
        service = config["config"]["provider"]["key"]
        path = config["outcome"]["sourcePath"]

        lineCoverage, codecovUrl = get_codecov_data(repo, service, path)
        if lineCoverage and codecovUrl:
            return {
                "lineCoverage": lineCoverage,
                "coverageUrl": codecovUrl,
                "status": status.HTTP_200_OK,
            }, None
    except requests.exceptions.HTTPError as error:
        data = {
            "attemptedUrl": error.response.url,
            "status": error.response.status_code,
        }

        message = None
        if error.response.status_code == status.HTTP_404_NOT_FOUND:
            message = "Failed to get expected data from Codecov. Continuing execution."

        return data, message
    except requests.Timeout:
        with configure_scope() as scope:
            scope.set_tag("codecov.timeout", True)
        return {
            "status": status.HTTP_408_REQUEST_TIMEOUT,
        }, "Codecov request timed out. Continuing execution."
    except Exception:
        return {
            "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
        }, "Something unexpected happened. Continuing execution."

    return None, None
