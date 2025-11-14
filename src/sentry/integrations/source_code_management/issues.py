from __future__ import annotations

from abc import ABC
from collections.abc import Mapping
from typing import int, Any

from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.repository import BaseRepositoryIntegration
from sentry.integrations.utils.metrics import EventLifecycle
from sentry.models.group import Group
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

SOURCE_CODE_ISSUE_HALT_PATTERNS = {
    "No workspace with identifier",  # Bitbucket
}


class SourceCodeIssueIntegration(IssueBasicIntegration, BaseRepositoryIntegration, ABC):
    def record_event(self, event: SCMIntegrationInteractionType) -> SCMIntegrationInteractionEvent:
        return SCMIntegrationInteractionEvent(
            interaction_type=event,
            provider_key=self.model.provider,
            organization_id=self.organization.id,
            integration_id=self.org_integration.integration_id,
        )

    def _get_repository_choices(
        self,
        *,
        group: Group | None,
        params: Mapping[str, Any],
        lifecycle: EventLifecycle,
        page_number_limit: int | None = None,
    ) -> tuple[str, list[tuple[str, str | int]]]:
        try:
            repos = self.get_repositories(page_number_limit=page_number_limit)
        except ApiError as exc:
            if any(pattern in str(exc) for pattern in SOURCE_CODE_ISSUE_HALT_PATTERNS):
                lifecycle.record_halt(exc)
            else:
                lifecycle.record_failure(exc)
            raise IntegrationError("Unable to retrieve repositories. Please try again later.")
        else:
            repo_choices = [(repo["identifier"], repo["name"]) for repo in repos]

        defaults = self.get_project_defaults(group.project_id) if group else {}
        repo = params.get("repo") or defaults.get("repo")

        try:
            default_repo = repo or repo_choices[0][0]
        except IndexError:
            return "", repo_choices

        # If a repo has been selected outside of the default list of
        # repos, stick it onto the front of the list so that it can be
        # selected.
        try:
            next(True for r in repo_choices if r[0] == default_repo)
        except StopIteration:
            repo_choices.insert(0, self.create_default_repo_choice(default_repo))

        return default_repo, repo_choices

    def get_repository_choices(
        self, group: Group | None, params: Mapping[str, Any], page_number_limit: int | None = None
    ) -> tuple[str, list[tuple[str, str | int]]]:
        """
        Returns the default repository and a set/subset of repositories of associated with the installation
        """
        user_facing_error = None
        with self.record_event(
            SCMIntegrationInteractionType.GET_REPOSITORY_CHOICES
        ).capture() as lifecycle:
            try:
                return self._get_repository_choices(
                    group=group,
                    params=params,
                    lifecycle=lifecycle,
                    page_number_limit=page_number_limit,
                )
            except IntegrationError as exc:
                user_facing_error = exc
        # Now that we're outside the lifecycle, we can raise the user facing error
        if user_facing_error:
            raise user_facing_error
        assert False, "Unreachable"

    # TODO(saif): Make private and move all usages over to `get_defaults`
    def get_project_defaults(self, project_id: int | str) -> dict[str, str]:
        if not self.org_integration:
            return {}

        return self.org_integration.config.get("project_issue_defaults", {}).get(
            str(project_id), {}
        )

    def create_default_repo_choice(self, default_repo: str) -> tuple[str, str]:
        """
        Helper method for get_repository_choices
        Returns the choice for the default repo in a tuple to be added to the list of repository choices
        """
        return (default_repo, default_repo)
