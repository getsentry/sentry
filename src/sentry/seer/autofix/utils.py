import logging
from datetime import UTC, datetime
from enum import StrEnum
from typing import NotRequired, TypedDict

import orjson
import pydantic
import requests
from django.conf import settings
from pydantic import BaseModel
from rest_framework import serializers
from urllib3 import Retry

from sentry import features, options, ratelimits
from sentry.constants import DataCategory
from sentry.issues.auto_source_code_config.code_mapping import get_sorted_code_mapping_configs
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.net.http import connection_from_url
from sentry.seer.autofix.constants import AutofixAutomationTuningSettings, AutofixStatus
from sentry.seer.models import (
    SeerApiError,
    SeerApiResponseValidationError,
    SeerPermissionError,
    SeerProjectPreference,
    SeerRawPreferenceResponse,
    SeerRepoDefinition,
)
from sentry.seer.signed_seer_api import make_signed_seer_api_request, sign_with_seer_secret
from sentry.utils import json
from sentry.utils.cache import cache
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger(__name__)


class AutofixIssue(TypedDict):
    id: int
    title: str
    short_id: NotRequired[str | None]


class AutofixStoppingPoint(StrEnum):
    ROOT_CAUSE = "root_cause"
    SOLUTION = "solution"
    CODE_CHANGES = "code_changes"
    OPEN_PR = "open_pr"


class AutofixRequest(BaseModel):
    organization_id: int
    project_id: int
    issue: AutofixIssue
    repos: list[SeerRepoDefinition]

    class Config:
        extra = "allow"


class FileChange(BaseModel):
    path: str
    content: str | None = None
    is_deleted: bool = False


class CodingAgentStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

    @classmethod
    def from_cursor_status(cls, cursor_status: str) -> "CodingAgentStatus | None":
        status_mapping = {
            "FINISHED": cls.COMPLETED,
            "ERROR": cls.FAILED,
        }

        return status_mapping.get(cursor_status.upper(), None)


class AutofixTriggerSource(StrEnum):
    ROOT_CAUSE = "root_cause"
    SOLUTION = "solution"


class CodingAgentResult(BaseModel):
    description: str
    repo_provider: str
    repo_full_name: str
    branch_name: str | None = None
    pr_url: str | None = None


class CodingAgentProviderType(StrEnum):
    CURSOR_BACKGROUND_AGENT = "cursor_background_agent"


class CodingAgentState(BaseModel):
    id: str
    status: CodingAgentStatus = CodingAgentStatus.PENDING
    agent_url: str | None = None
    provider: CodingAgentProviderType
    name: str
    started_at: datetime
    results: list[CodingAgentResult] = []


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
    steps: list[dict] = []
    coding_agents: dict[str, CodingAgentState] = {}

    class Config:
        extra = "allow"


class CodingAgentStateUpdate(BaseModel):
    status: CodingAgentStatus | None = None
    agent_url: str | None = None
    results: list[CodingAgentResult] | None = None


class CodingAgentStateUpdateRequest(BaseModel):
    agent_id: str
    updates: CodingAgentStateUpdate


autofix_connection_pool = connection_from_url(
    settings.SEER_AUTOFIX_URL,
)


class SeerAutofixSettingsSerializer(serializers.Serializer):
    """Base serializer for autofixAutomationTuning and automatedRunStoppingPoint"""

    autofixAutomationTuning = serializers.ChoiceField(
        choices=[opt.value for opt in AutofixAutomationTuningSettings],
        required=False,
        help_text="The tuning setting for the projects.",
    )
    automatedRunStoppingPoint = serializers.ChoiceField(
        choices=[opt.value for opt in AutofixStoppingPoint],
        required=False,
        help_text="The stopping point for the projects.",
    )

    def validate(self, data):
        if "autofixAutomationTuning" not in data and "automatedRunStoppingPoint" not in data:
            raise serializers.ValidationError(
                "At least one of 'autofixAutomationTuning' or 'automatedRunStoppingPoint' must be provided."
            )
        return data


def default_seer_project_preference(project: Project) -> SeerProjectPreference:
    return SeerProjectPreference(
        organization_id=project.organization.id,
        project_id=project.id,
        repositories=[],
        automated_run_stopping_point=AutofixStoppingPoint.CODE_CHANGES.value,
        automation_handoff=None,
    )


def get_project_seer_preferences(project_id: int) -> SeerRawPreferenceResponse:
    """
    Fetch Seer project preferences from the Seer API.

    Args:
        project_id: The project ID to fetch preferences for

    Returns:
        SeerRawPreferenceResponse object if successful
    """
    path = "/v1/project-preference"
    body = orjson.dumps({"project_id": project_id})

    response = make_signed_seer_api_request(
        autofix_connection_pool,
        path,
        body=body,
        timeout=5,
        retries=Retry(total=2, backoff_factor=0.5),
    )

    if response.status == 200:
        try:
            result = orjson.loads(response.data)
            return SeerRawPreferenceResponse.validate(result)
        except (pydantic.ValidationError, orjson.JSONDecodeError, UnicodeDecodeError) as e:
            raise SeerApiResponseValidationError(str(e)) from e

    raise SeerApiError(response.data.decode("utf-8"), response.status)


def set_project_seer_preference(preference: SeerProjectPreference) -> None:
    """Set Seer project preference for a single project."""
    path = "/v1/project-preference/set"
    body = orjson.dumps({"preference": preference.dict()})

    response = make_signed_seer_api_request(
        autofix_connection_pool,
        path,
        body=body,
        timeout=15,
    )

    if response.status >= 400:
        raise SeerApiError(response.data.decode("utf-8"), response.status)


def has_project_connected_repos(
    organization_id: int, project_id: int, *, skip_cache: bool = False
) -> bool:
    """
    Check if a project has connected repositories for Seer automation.
    Checks Seer preferences first, then falls back to Sentry code mappings.
    Results are cached for 15 minutes to minimize API calls.
    """
    cache_key = f"seer-project-has-repos:{organization_id}:{project_id}"
    if not skip_cache:
        cached_value = cache.get(cache_key)
        if cached_value is not None:
            return cached_value

    has_repos = False

    try:
        project_preferences = get_project_seer_preferences(project_id)
        has_repos = bool(
            project_preferences.preference and project_preferences.preference.repositories
        )
    except (SeerApiError, SeerApiResponseValidationError):
        pass

    if not has_repos:
        # If it's the first autofix run of project we check code mapping.
        try:
            project = Project.objects.get(id=project_id)
            has_repos = bool(get_autofix_repos_from_project_code_mappings(project))
        except Project.DoesNotExist:
            pass

    logger.info(
        "Checking if project has repositories connected",
        extra={
            "org_id": organization_id,
            "project_id": project_id,
            "has_repos": has_repos,
        },
    )

    cache.set(cache_key, has_repos, timeout=60 * 15)  # Cache for 15 minutes
    return has_repos


def bulk_get_project_preferences(organization_id: int, project_ids: list[int]) -> dict[str, dict]:
    """Bulk fetch Seer project preferences. Returns dict mapping project ID (string) to preference dict."""
    path = "/v1/project-preference/bulk"
    body = orjson.dumps({"organization_id": organization_id, "project_ids": project_ids})

    response = make_signed_seer_api_request(
        autofix_connection_pool,
        path,
        body=body,
        timeout=10,
    )

    if response.status >= 400:
        raise SeerApiError(response.data.decode("utf-8"), response.status)

    result = orjson.loads(response.data)
    return result.get("preferences", {})


def bulk_set_project_preferences(organization_id: int, preferences: list[dict]) -> None:
    """Bulk set Seer project preferences for multiple projects."""
    if not preferences:
        return

    path = "/v1/project-preference/bulk-set"
    body = orjson.dumps({"organization_id": organization_id, "preferences": preferences})

    response = make_signed_seer_api_request(
        autofix_connection_pool,
        path,
        body=body,
        timeout=15,
    )

    if response.status >= 400:
        raise SeerApiError(response.data.decode("utf-8"), response.status)


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
                "organization_id": repo.organization_id,
                "integration_id": (
                    str(repo.integration_id) if repo.integration_id is not None else None
                ),
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
    organization_id: int,
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
            state = AutofixState.validate(result["state"])

            if state.request.organization_id != organization_id:
                raise SeerPermissionError("Different organization ID found in autofix state")

            return state

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

    state = result.get("state", None)
    if state is None:
        return None

    return AutofixState.validate(state)


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

    limit = options.get("seer.max_num_scanner_autotriggered_per_ten_seconds", 15)
    is_rate_limited, current, _ = ratelimits.backend.is_limited_with_value(
        project=project,
        key="seer.scanner.auto_triggered",
        limit=limit,
        window=10,  # 10 seconds
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


def get_seer_seat_based_tier_cache_key(organization_id: int) -> str:
    """Get the cache key for seat-based Seer tier check."""
    return f"seer:seat-based-tier:{organization_id}"


def is_seer_seat_based_tier_enabled(organization: Organization) -> bool:
    """
    Check if organization has Seer seat-based pricing via billing.
    """
    if features.has("organizations:triage-signals-v0-org", organization):
        return True

    cache_key = get_seer_seat_based_tier_cache_key(organization.id)
    cached_value = cache.get(cache_key)
    if cached_value is not None:
        return cached_value

    try:
        has_seat_based_seer = features.has("organizations:seat-based-seer-enabled", organization)
    except Exception:
        # This flag will throw an error for self hosted Sentry since it lives in getsentry.
        has_seat_based_seer = False

    cache.set(cache_key, has_seat_based_seer, timeout=60 * 60 * 4)  # 4 hours TTL

    return has_seat_based_seer


def is_issue_eligible_for_seer_automation(group: Group) -> bool:
    """Check if Seer automation is allowed for a given group based on permissions and issue type."""
    from sentry import quotas
    from sentry.issues.grouptype import GroupCategory

    # check currently supported issue categories for Seer
    if group.issue_category not in [
        GroupCategory.ERROR,
        GroupCategory.PERFORMANCE,
        GroupCategory.MOBILE,
        GroupCategory.FRONTEND,
        GroupCategory.DB_QUERY,
        GroupCategory.HTTP_CLIENT,
    ] or group.issue_category in [
        GroupCategory.REPLAY,
        GroupCategory.FEEDBACK,
    ]:
        return False

    if not features.has("organizations:gen-ai-features", group.organization):
        return False

    gen_ai_allowed = not group.organization.get_option("sentry:hide_ai_features")
    if not gen_ai_allowed:
        return False

    project = group.project
    if (
        not project.get_option("sentry:seer_scanner_automation")
        and not group.issue_type.always_trigger_seer_automation
    ):
        return False

    from sentry.seer.seer_setup import get_seer_org_acknowledgement_for_scanner

    seer_enabled = get_seer_org_acknowledgement_for_scanner(group.organization)
    if not seer_enabled:
        return False

    has_budget: bool = quotas.backend.check_seer_quota(
        org_id=group.organization.id, data_category=DataCategory.SEER_SCANNER
    )
    if not has_budget:
        return False

    return True


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


def get_autofix_prompt(run_id: int, include_root_cause: bool, include_solution: bool) -> str:
    """Get the autofix prompt from Seer API."""

    path = "/v1/automation/autofix/prompt"
    body = orjson.dumps(
        {
            "run_id": run_id,
            "include_root_cause": include_root_cause,
            "include_solution": include_solution,
        }
    )

    response = make_signed_seer_api_request(
        autofix_connection_pool,
        path,
        body=body,
        timeout=15,
    )

    if response.status >= 400:
        raise SeerApiError(response.data.decode("utf-8"), response.status)

    response_data = orjson.loads(response.data)

    return response_data.get("prompt")


def get_coding_agent_prompt(
    run_id: int,
    trigger_source: AutofixTriggerSource,
    instruction: str | None = None,
    short_id: str | None = None,
) -> str:
    """Get the coding agent prompt with prefix from Seer API."""
    include_root_cause = trigger_source in [
        AutofixTriggerSource.ROOT_CAUSE,
        AutofixTriggerSource.SOLUTION,
    ]
    include_solution = trigger_source == AutofixTriggerSource.SOLUTION

    autofix_prompt = get_autofix_prompt(run_id, include_root_cause, include_solution)

    base_prompt = "Please fix the following issue. Ensure that your fix is fully working."

    if short_id:
        base_prompt = (
            f"{base_prompt}\n\nInclude 'Fixes {short_id}' in the pull request description."
        )

    if instruction and instruction.strip():
        base_prompt = f"{base_prompt}\n\n{instruction.strip()}"

    return f"{base_prompt}\n\n{autofix_prompt}"


def update_coding_agent_state(
    *,
    agent_id: str,
    status: CodingAgentStatus,
    agent_url: str | None = None,
    result: CodingAgentResult | None = None,
) -> None:
    """Send coding agent state update to Seer.

    Raises SeerApiError for non-2xx responses.
    """
    path = "/v1/automation/autofix/coding-agent/state/update"

    updates = CodingAgentStateUpdate(
        status=status,
        agent_url=agent_url,
        results=[result.dict()] if result is not None else None,
    )

    update_data = CodingAgentStateUpdateRequest(
        agent_id=agent_id,
        updates=updates,
    )

    body = orjson.dumps(update_data.dict(exclude_none=True))

    response = make_signed_seer_api_request(
        autofix_connection_pool,
        path,
        body=body,
        timeout=30,
    )

    if response.status >= 400:
        raise SeerApiError(response.data.decode("utf-8"), response.status)
