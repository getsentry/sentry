import logging
from collections.abc import Callable
from dataclasses import dataclass
from functools import wraps
from typing import Any, TypedDict

import sentry_sdk

from sentry.api.serializers import serialize
from sentry.api.serializers.models.event import EventSerializer
from sentry.constants import ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.seer.sentry_data_models import IssueDetails

logger = logging.getLogger(__name__)


MAX_NUM_ISSUES_DEFAULT = 10
MAX_NUM_DAYS_AGO_DEFAULT = 90


class SeerResponseError(TypedDict):
    error: str


def handle_fetch_issues_exceptions[R](
    func: Callable[..., R],
) -> Callable[..., R | SeerResponseError]:
    @wraps(func)
    def wrapper(*args: Any, **kwargs: Any) -> R | SeerResponseError:
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.warning("Exception in fetch_issues function", exc_info=True)
            return SeerResponseError(error=str(e))

    return wrapper


@dataclass
class RepoInfo:
    organization_id: int
    provider: str
    external_id: str


@dataclass
class RepoProjects(RepoInfo):
    repo: Repository
    repo_configs: list[RepositoryProjectPathConfig]
    projects: list[Project]


class SeerResponse(TypedDict):
    issues: list[int]
    issues_full: list[dict[str, Any]]


def get_repo_and_projects(
    organization_id: int,
    provider: str,
    external_id: str,
    run_id: int | None = None,
) -> RepoProjects:
    """
    Returns auxilliary info about the repo and its projects.
    This info is often needed to go from repo -> project -> issue.

    Note
    ----
    `provider` refers to the field in the DB, e.g. `"integrations:github"`.

    In seer.automation.models.RepoDefinition, this is the `provider_raw` attribute, not `provider`.
    """
    sentry_sdk.set_tags(
        {
            "organization_id": organization_id,
            "provider": provider,
            "external_id": external_id,
            "run_id": run_id,
        }
    )
    repo = Repository.objects.get(
        organization_id=organization_id, provider=provider, external_id=external_id
    )
    repo_configs = list(
        RepositoryProjectPathConfig.objects.filter(
            organization_id=organization_id,
            repository_id=repo.id,
            status=ObjectStatus.ACTIVE,
        )
    )
    projects = [config.project for config in repo_configs]
    if not projects:
        raise ValueError("No Sentry projects found for repo")
    return RepoProjects(
        organization_id=organization_id,
        provider=provider,
        external_id=external_id,
        repo=repo,
        repo_configs=repo_configs,
        projects=projects,
    )


def as_issue_details(group: Group | None) -> IssueDetails | None:
    if group is None:
        return None
    group_serialized: dict[str, Any] | None = serialize(group)
    if group_serialized is None:
        return None
    group_serialized["message"] = group.message
    return IssueDetails(
        id=group_serialized["id"],
        title=group_serialized["title"],
        culprit=group_serialized.get("culprit"),
        transaction=None,
        events=[],
        metadata=group_serialized.get("metadata", {}),
        message=group_serialized.get("message", ""),
    )


def bulk_serialize_for_seer(groups: list[Group]) -> SeerResponse:
    """
    Returns a list of dicts matching the Seer IssueDetails model. Unserializable groups are filtered out.
    """
    issue_details = [as_issue_details(group) for group in groups]
    # Currently, Seer expects this structure. TODO(kddubey): should just be the issues_full list
    issues_full = [issue.dict() for issue in issue_details if issue is not None]
    issue_ids = [issue["id"] for issue in issues_full]
    for issue in issues_full:
        issue["id"] = str(issue["id"])
    return {
        "issues": issue_ids,
        "issues_full": issues_full,
    }


def _group_by_short_id(short_id: str, organization_id: int) -> Group | None:
    try:
        return Group.objects.by_qualified_short_id(organization_id, short_id)
    except Group.DoesNotExist:
        return None


def get_latest_issue_event(group_id: int | str, organization_id: int) -> dict[str, Any]:
    """
    Get an issue's latest event as a dict, matching the Seer IssueDetails model.
    """
    if isinstance(group_id, str) and not group_id.isdigit():
        group = _group_by_short_id(group_id, organization_id)
    else:
        group = Group.objects.filter(id=int(group_id)).first()

    if not group:
        logger.warning(
            "Group not found", extra={"group_id": group_id, "organization_id": organization_id}
        )
        return {}

    if group.organization.id != organization_id:
        logger.warning(
            "Group does not belong to expected organization",
            extra={
                "group_id": group_id,
                "organization_id": organization_id,
                "actual_organization_id": group.organization.id,
            },
        )
        return {}

    event = group.get_latest_event()
    if not event:
        logger.warning(
            "No event found",
            extra={"group_id": group_id},
        )
        return {}

    serialized_event = serialize(event, user=None, serializer=EventSerializer())
    return IssueDetails(
        id=int(serialized_event["groupID"]),
        title=serialized_event["title"],
        events=[serialized_event],
    ).dict()
