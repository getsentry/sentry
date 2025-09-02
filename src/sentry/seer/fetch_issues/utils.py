import logging
from dataclasses import dataclass
from typing import Any

import sentry_sdk

from sentry.api.serializers import serialize
from sentry.api.serializers.models.event import EventSerializer
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.seer.sentry_data_models import IssueDetails

logger = logging.getLogger(__name__)


MAX_NUM_ISSUES_DEFAULT = 10
MAX_NUM_DAYS_AGO_DEFAULT = 90


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
        )
    )
    return RepoProjects(
        organization_id=organization_id,
        provider=provider,
        external_id=external_id,
        repo=repo,
        repo_configs=repo_configs,
        projects=[config.project for config in repo_configs],
    )


def as_issue_details(group: Group | None) -> IssueDetails | None:
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
        # TODO(kddubey): add optional fields to IssueDetails and supply them here
    )


def bulk_serialize_for_seer(groups: list[Group]) -> list[dict[str, Any] | None]:
    """
    Returns a list of dicts matching the Seer IssueDetails model. Unserializable groups are `None`.
    """
    issue_details = [as_issue_details(group) for group in groups]
    return [issue.dict() if issue is not None else None for issue in issue_details]


def get_latest_issue_event(group_id: int) -> dict[str, Any]:
    """
    Get an issue's latest event as a dict, matching the Seer IssueDetails model.
    """
    group = Group.objects.filter(id=group_id).first()
    if not group:
        logger.warning(
            "Group not found",
            extra={"group_id": group_id},
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
