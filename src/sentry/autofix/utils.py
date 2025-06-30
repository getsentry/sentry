import enum
import logging
from datetime import UTC, datetime
from typing import TypedDict

import orjson
import requests
from django.conf import settings
from pydantic import BaseModel

from sentry import features, options, ratelimits
from sentry.constants import DataCategory
from sentry.issues.auto_source_code_config.code_mapping import get_sorted_code_mapping_configs
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.seer.seer_utils import AutofixAutomationTuningSettings
from sentry.seer.signed_seer_api import sign_with_seer_secret
from sentry.utils import json
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger(__name__)


class AutofixIssue(TypedDict):
    id: int


class AutofixRequest(TypedDict):
    project_id: int
    issue: AutofixIssue


class AutofixStatus(str, enum.Enum):
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"
    PROCESSING = "PROCESSING"
    NEED_MORE_INFORMATION = "NEED_MORE_INFORMATION"
    CANCELLED = "CANCELLED"
    WAITING_FOR_USER_RESPONSE = "WAITING_FOR_USER_RESPONSE"


class FileChange(BaseModel):
    path: str
    content: str | None = None
    is_deleted: bool = False


class CodebaseState(BaseModel):
    repo_external_id: str | None = None
    file_changes: list[FileChange] = []
    is_readable: bool | None = None
    is_writeable: bool | None = None


class AutofixState(BaseModel):
    run_id: int
    request: AutofixRequest
    updated_at: datetime
    status: AutofixStatus
    actor_ids: list[str] | None = None
    codebases: dict[str, CodebaseState] = {}

    class Config:
        extra = "allow"


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


def get_autofix_state(
    *,
    group_id: int | None = None,
    run_id: int | None = None,
    check_repo_access: bool = False,
    is_user_fetching: bool = False,
) -> AutofixState | None:
    path = "/v1/automation/autofix/state"
    body = orjson.dumps(
        {
            "group_id": group_id,
            "run_id": run_id,
            "check_repo_access": check_repo_access,
            "is_user_fetching": is_user_fetching,
        }
    )

    response = requests.post(
        f"{settings.SEER_AUTOFIX_URL}{path}",
        data=body,
        headers={
            "content-type": "application/json;charset=utf-8",
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()

    result = response.json()

    if result:
        if (
            group_id is not None
            and result["group_id"] == group_id
            or run_id is not None
            and result["run_id"] == run_id
        ):
            return AutofixState.validate(result["state"])

    return None


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
            **sign_with_seer_secret(body),
        },
    )

    response.raise_for_status()
    result = response.json()

    if not result:
        return None

    return AutofixState.validate(result.get("state", None))


class SeerAutomationSource(enum.Enum):
    ISSUE_DETAILS = "issue_details"
    ALERT = "alert"
    POST_PROCESS = "post_process"


def is_seer_scanner_rate_limited(project: Project, organization: Organization) -> bool:
    """
    Check if Seer Scanner automation is rate limited for a given project and organization.
    Calling this method increments the counter used to enforce the rate limit, and tracks rate limited outcomes.

    Args:
        project: The project to check.
        organization: The organization to check.

    Returns:
        bool: Whether the seer scanner is rate limited.
    """
    if features.has("organizations:unlimited-auto-triggered-autofix-runs", organization):
        return False

    limit = options.get("seer.max_num_scanner_autotriggered_per_minute", 50)
    is_rate_limited, current, _ = ratelimits.backend.is_limited_with_value(
        project=project,
        key="seer.scanner.auto_triggered",
        limit=limit,
        window=60,  # 1 minute
    )
    if is_rate_limited:
        logger.info(
            "Seer scanner auto-trigger rate limit hit",
            extra={
                "org_slug": organization.slug,
                "project_slug": project.slug,
                "scanner_run_count": current,
                "scanner_run_limit": limit,
            },
        )
        track_outcome(
            org_id=organization.id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.RATE_LIMITED,
            reason="rate_limited",
            timestamp=datetime.now(UTC),
            category=DataCategory.SEER_SCANNER,
        )
    return is_rate_limited


AUTOFIX_AUTOTRIGGED_RATE_LIMIT_OPTION_MULTIPLIERS = {
    AutofixAutomationTuningSettings.OFF: 5,
    AutofixAutomationTuningSettings.SUPER_LOW: 5,
    AutofixAutomationTuningSettings.LOW: 4,
    AutofixAutomationTuningSettings.MEDIUM: 3,
    AutofixAutomationTuningSettings.HIGH: 2,
    AutofixAutomationTuningSettings.ALWAYS: 1,
    None: 1,  # default if option is not set
}


def is_seer_autotriggered_autofix_rate_limited(
    project: Project, organization: Organization
) -> bool:
    """
    Check if Seer Autofix automation is rate limited for a given project and organization.
    Calling this method increments the counter used to enforce the rate limit, and tracks rate limited outcomes.

    Args:
        project: The project to check.
        organization: The organization to check.

    Returns:
        bool: Whether Autofix is rate limited.
    """
    if features.has("organizations:unlimited-auto-triggered-autofix-runs", organization):
        return False

    limit = options.get("seer.max_num_autofix_autotriggered_per_hour", 20)

    # The more selective automation is, the higher the limit we allow.
    # This is to protect projects with extreme settings from starting too many runs
    # while allowing big projects with reasonable settings to run more often.
    option = project.get_option("sentry:autofix_automation_tuning")
    multiplier = AUTOFIX_AUTOTRIGGED_RATE_LIMIT_OPTION_MULTIPLIERS.get(option, 1)
    limit *= multiplier

    is_rate_limited, current, _ = ratelimits.backend.is_limited_with_value(
        project=project,
        key="autofix.auto_triggered",
        limit=limit,
        window=60 * 60,  # 1 hour
    )
    if is_rate_limited:
        logger.info(
            "Autofix auto-trigger rate limit hit",
            extra={
                "auto_run_count": current,
                "auto_run_limit": limit,
                "org_slug": organization.slug,
                "project_slug": project.slug,
            },
        )
        track_outcome(
            org_id=organization.id,
            project_id=project.id,
            key_id=None,
            outcome=Outcome.RATE_LIMITED,
            reason="rate_limited",
            timestamp=datetime.now(UTC),
            category=DataCategory.SEER_AUTOFIX,
        )
    return is_rate_limited
