from typing import TypedDict

import requests
from django.conf import settings

from sentry.integrations.utils.code_mapping import get_sorted_code_mapping_configs
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json


class AutofixIssue(TypedDict):
    id: int


class AutofixRequest(TypedDict):
    project_id: int
    issue: AutofixIssue


class AutofixState(TypedDict):
    run_id: int
    request: AutofixRequest


def get_autofix_repos_from_project_code_mappings(project: Project) -> list[dict]:
    if settings.SEER_AUTOFIX_FORCE_USE_REPOS:
        # This is for testing purposes only, for example in s4s we want to force the use of specific repo(s)
        return settings.SEER_AUTOFIX_FORCE_USE_REPOS

    code_mappings = get_sorted_code_mapping_configs(project)

    repos: dict[tuple, dict] = {}
    for code_mapping in code_mappings:
        repo: Repository = code_mapping.repository
        repo_name_sections = repo.name.split("/")

        # We expect a repository name to be in the format of "owner/name" for now.
        if len(repo_name_sections) > 1 and repo.provider:
            repo_dict = {
                "provider": repo.provider,
                "owner": repo_name_sections[0],
                "name": "/".join(repo_name_sections[1:]),
                "external_id": repo.external_id,
            }
            repo_key = (repo_dict["provider"], repo_dict["owner"], repo_dict["name"])

            repos[repo_key] = repo_dict

    return list(repos.values())


def get_autofix_state_from_pr_id(provider: str, pr_id: int) -> AutofixState | None:
    path = "/v1/automation/autofix/state/pr"
    body = json.dumps(
        {
            "provider": provider,
            "pr_id": pr_id,
        }
    ).encode("utf-8")
    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(
                url=f"{settings.SEER_AUTOFIX_URL}{path}",
                body=body,
            ),
        },
    )

    response.raise_for_status()
    result = response.json()

    if not result:
        return None

    return result.get("state", None)
