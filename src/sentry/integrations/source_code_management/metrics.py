from collections.abc import Mapping
from contextvars import ContextVar, Token
from enum import StrEnum
from types import TracebackType
from typing import Any, Self

from attr import dataclass

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.utils.metrics import (
    IntegrationEventLifecycle,
    IntegrationEventLifecycleMetric,
)
from sentry.models.commit import Commit
from sentry.models.project import Project
from sentry.models.repository import Repository


def normalize_scm_provider_key(provider_key: str) -> str:
    """Return the canonical integration provider slug."""
    return provider_key.removeprefix("integrations:")


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
    SYNC_REPOS = "sync_repos"
    SYNC_REPOS_ON_INSTALL_CHANGE = "sync_repos_on_install_change"

    # GitHub only
    DERIVE_CODEMAPPINGS = "derive_codemappings"
    STUDENT_PACK = "student_pack"

    # Releases
    COMPARE_COMMITS = "compare_commits"
    LINK_ISSUE_TO_PR = "link_issue_to_pr"
    RESOLVE_ISSUE_VIA_COMMIT = "resolve_issue_via_commit"
    RESOLVE_ISSUE_VIA_PR = "resolve_issue_via_pr"

    # Status Checks
    CREATE_STATUS_CHECK = "create_status_check"

    # Rate Limiting
    GET_RATE_LIMIT = "get_rate_limit"

    # Repo Trees
    GET_REPO_TREE = "get_repo_tree"


_current_scm_interaction_type: ContextVar[SCMIntegrationInteractionType | None] = ContextVar(
    "current_scm_interaction_type", default=None
)


def get_current_scm_interaction_type() -> SCMIntegrationInteractionType | None:
    return _current_scm_interaction_type.get()


class SCMIntegrationEventLifecycle(IntegrationEventLifecycle):
    def __init__(
        self,
        payload: IntegrationEventLifecycleMetric,
        interaction_type: SCMIntegrationInteractionType,
        assume_success: bool,
        sample_log_rate: float,
    ) -> None:
        super().__init__(payload, assume_success, sample_log_rate)
        self.interaction_type = interaction_type
        self._interaction_token: Token[SCMIntegrationInteractionType | None] | None = None

    def __enter__(self) -> Self:
        self._interaction_token = _current_scm_interaction_type.set(self.interaction_type)
        try:
            return super().__enter__()
        except BaseException:
            _current_scm_interaction_type.reset(self._interaction_token)
            self._interaction_token = None
            raise

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType,
    ) -> None:
        try:
            super().__exit__(exc_type, exc_value, traceback)
        finally:
            if self._interaction_token is not None:
                _current_scm_interaction_type.reset(self._interaction_token)
                self._interaction_token = None


class SCMResolutionHaltReason(StrEnum):
    GROUP_LINK_ALREADY_EXISTS = "group_link_already_exists"
    ISSUE_ALREADY_RESOLVED = "issue_already_resolved"


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
        return normalize_scm_provider_key(self.provider_key)

    def get_interaction_type(self) -> str:
        return str(self.interaction_type)

    def get_integration_id(self) -> int | None:
        return self.integration_id

    def capture(
        self, assume_success: bool = True, sample_log_rate: float = 1.0
    ) -> SCMIntegrationEventLifecycle:
        return SCMIntegrationEventLifecycle(
            self,
            self.interaction_type,
            assume_success,
            sample_log_rate,
        )

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
