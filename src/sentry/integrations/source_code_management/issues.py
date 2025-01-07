from __future__ import annotations

from abc import ABC
from collections.abc import Mapping
from typing import Any

from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.integrations.source_code_management.repository import BaseRepositoryIntegration
from sentry.models.group import Group
from sentry.shared_integrations.exceptions import ApiError, IntegrationError


class SourceCodeIssueIntegration(IssueBasicIntegration, BaseRepositoryIntegration, ABC):
    def record_event(self, event: SCMIntegrationInteractionType):
        return SCMIntegrationInteractionEvent(
            interaction_type=event,
            provider_key=self.model.provider,
            organization=self.organization,
            org_integration=self.org_integration,
        )

    def get_repository_choices(self, group: Group | None, params: Mapping[str, Any], **kwargs):
        """
        Returns the default repository and a set/subset of repositories of associated with the installation
        """
        with self.record_event(SCMIntegrationInteractionType.GET_REPOSITORY_CHOICES).capture():
            try:
                repos = self.get_repositories()
            except ApiError:
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

    # TODO(saif): Make private and move all usages over to `get_defaults`
    def get_project_defaults(self, project_id):
        if not self.org_integration:
            return {}

        return self.org_integration.config.get("project_issue_defaults", {}).get(
            str(project_id), {}
        )

    def create_default_repo_choice(self, default_repo):
        """
        Helper method for get_repository_choices
        Returns the choice for the default repo in a tuple to be added to the list of repository choices
        """
        return (default_repo, default_repo)
