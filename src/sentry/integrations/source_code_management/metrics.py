from collections.abc import Mapping
from enum import StrEnum
from typing import int, Any

from attr import dataclass

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.utils.metrics import IntegrationEventLifecycleMetric
from sentry.models.commit import Commit
from sentry.models.project import Project
from sentry.models.repository import Repository


class SCMIntegrationInteractionType(StrEnum):
    """
    SCM integration features
    """

    # RepositoryIntegration
    GET_STACKTRACE_LINK = "get_stacktrace_link"
    GET_CODEOWNER_FILE = "get_codeowner_file"
    CHECK_FILE = "check_file"

    # SourceCodeIssueIntegration (SCM only)
    GET_REPOSITORY_CHOICES = "get_repository_choices"

    # SourceCodeSearchEndpoint
    HANDLE_SEARCH_ISSUES = "handle_search_issues"
    HANDLE_SEARCH_REPOSITORIES = "handle_search_repositories"
    GET = "get"

    # CommitContextIntegration
    GET_BLAME_FOR_FILES = "get_blame_for_files"
    CREATE_COMMENT = "create_comment"
    UPDATE_COMMENT = "update_comment"
    QUEUE_COMMENT_TASK = "queue_comment_task"
    GET_PR_DIFFS = "get_pr_diffs"  # open PR comments

    GET_PR_COMMENTS = "get_pr_comments"
    GET_ISSUE_COMMENTS = "get_issue_comments"

    # Tasks
    LINK_ALL_REPOS = "link_all_repos"

    # GitHub only
    DERIVE_CODEMAPPINGS = "derive_codemappings"
    STUDENT_PACK = "student_pack"

    # Releases
    COMPARE_COMMITS = "compare_commits"

    # Status Checks
    CREATE_STATUS_CHECK = "create_status_check"


@dataclass
class SCMIntegrationInteractionEvent(IntegrationEventLifecycleMetric):
    """
    An instance to be recorded of an SCM integration feature call.
    """

    interaction_type: SCMIntegrationInteractionType
    provider_key: str
    integration_id: int | None = None
    organization_id: int | None = None

    def get_integration_domain(self) -> IntegrationDomain:
        return IntegrationDomain.SOURCE_CODE_MANAGEMENT

    def get_integration_name(self) -> str:
        return self.provider_key

    def get_interaction_type(self) -> str:
        return str(self.interaction_type)

    def get_extras(self) -> Mapping[str, Any]:
        return {
            "organization_id": (self.organization_id if self.organization_id else None),
            "integration_id": (self.integration_id if self.integration_id else None),
        }


@dataclass
class CommitContextIntegrationInteractionEvent(SCMIntegrationInteractionEvent):
    """
    An instance to be recorded of a CommitContextIntegration feature call.
    """

    project: Project | None = None
    commit: Commit | None = None
    repository: Repository | None = None
    pull_request_id: int | None = None

    def get_extras(self) -> Mapping[str, Any]:
        parent_extras = super().get_extras()
        return {
            **parent_extras,
            "project_id": (self.project.id if self.project else None),
            "commit_id": (self.commit.id if self.commit else None),
            "repository_id": (self.repository.id if self.repository else None),
            "pull_request_id": self.pull_request_id,
        }


class CommitContextHaltReason(StrEnum):
    """Common reasons why a commit context integration may halt without success/failure."""

    COMMIT_NOT_IN_DEFAULT_BRANCH = "commit_not_in_default_branch"
    MISSING_PR = "missing_pr"
    ALREADY_QUEUED = "already_queued"


class LinkAllReposHaltReason(StrEnum):
    """
    Common reasons why a link all repos task may halt without success/failure.
    """

    MISSING_INTEGRATION = "missing_integration"
    MISSING_ORGANIZATION = "missing_organization"
    RATE_LIMITED = "rate_limited"
    REPOSITORY_NOT_CREATED = "repository_not_created"


class SourceCodeSearchEndpointHaltReason(StrEnum):
    """
    Reasons why a SourceCodeSearchEndpoint method (handle_search_issues,
    handle_search_repositories, or get) may halt without success/failure.
    """

    NO_ISSUE_TRACKER = "no_issue_tracker"
    RATE_LIMITED = "rate_limited"
    MISSING_REPOSITORY_OR_NO_ACCESS = "missing_repository_or_no_access"
    MISSING_INTEGRATION = "missing_integration"
    SERIALIZER_ERRORS = "serializer_errors"
    MISSING_REPOSITORY_FIELD = "missing_repository_field"
