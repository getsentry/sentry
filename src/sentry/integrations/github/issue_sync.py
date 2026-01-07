from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from sentry import features
from sentry.integrations.mixins.issues import IssueSyncIntegration, ResolveSyncAction
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import EXTERNAL_PROVIDERS_REVERSE, ExternalProviderEnum
from sentry.shared_integrations.exceptions import ApiError
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

from .types import IssueEvenntWebhookActionType

logger = logging.getLogger("sentry.integrations.github.issue_sync")


class GitHubIssueSyncSpec(IssueSyncIntegration):
    comment_key = "sync_comments"
    outbound_status_key = "sync_status_forward"
    inbound_status_key = "sync_status_reverse"
    outbound_assignee_key = "sync_forward_assignment"
    inbound_assignee_key = "sync_reverse_assignment"
    resolution_strategy_key = "resolution_strategy"

    def check_feature_flag(self) -> bool:
        """
        A temporary method so we can gate Github & Github Enterprise project management features.
        """
        ff_key = f"organizations:integrations-{self.model.provider}-project-management"
        return features.has(ff_key, self.organization)

    def split_external_issue_key(
        self, external_issue_key: str
    ) -> tuple[str, str] | tuple[None, None]:
        """
        Split the external issue key into repo and issue number.
        """
        # Parse the external issue key to get repo and issue number
        # Format is "{repo_full_name}#{issue_number}"
        try:
            repo_id, issue_num = external_issue_key.split("#")
            return repo_id, issue_num
        except ValueError:
            logger.exception(
                "assignee-outbound.invalid-key",
                extra={
                    "external_issue_key": external_issue_key,
                    "provider": self.model.provider,
                },
            )
            return None, None

    def sync_assignee_outbound(
        self,
        external_issue: ExternalIssue,
        user: RpcUser | None,
        assign: bool = True,
        **kwargs: Any,
    ) -> None:
        """
        Propagate a sentry issue's assignee to a linked GitHub issue's assignee.
        If assign=True, we're assigning the issue. Otherwise, deassign.
        """
        client = self.get_client()

        repo_id, issue_num = self.split_external_issue_key(external_issue.key)

        if not repo_id or not issue_num:
            logger.error(
                "assignee-outbound.invalid-key",
                extra={
                    "provider": self.model.provider,
                    "integration_id": external_issue.integration_id,
                    "external_issue_key": external_issue.key,
                    "external_issue_id": external_issue.id,
                },
            )
            return

        github_username = None

        # If we're assigning and have a user, find their GitHub username
        if user and assign:
            # Check if user has a GitHub identity linked
            provider = EXTERNAL_PROVIDERS_REVERSE[ExternalProviderEnum(self.model.provider)].value
            external_actor = ExternalActor.objects.filter(
                provider=provider,
                user_id=user.id,
                integration_id=external_issue.integration_id,
                organization=external_issue.organization,
            ).first()
            if not external_actor:
                logger.info(
                    "assignee-outbound.external-actor-not-found",
                    extra={
                        "provider": self.model.provider,
                        "integration_id": external_issue.integration_id,
                        "user_id": user.id,
                    },
                )
                return

            # Strip the @ from the username
            github_username = external_actor.external_name.lstrip("@")
            # lowercase the username
            github_username = github_username.lower()

        # Only update GitHub if we have a username to assign or if we're explicitly deassigning
        if github_username or not assign:
            try:
                client.update_issue_assignees(
                    repo_id, issue_num, [github_username] if github_username else []
                )
            except Exception as e:
                self.raise_error(e)

    def sync_status_outbound(
        self, external_issue: ExternalIssue, is_resolved: bool, project_id: int
    ) -> None:
        """
        Propagate a sentry issue's status to a linked GitHub issue's status.
        For GitHub, we only support open/closed states.
        """
        client = self.get_client()

        repo_id, issue_num = self.split_external_issue_key(external_issue.key)

        if not repo_id or not issue_num:
            logger.error(
                "status-outbound.invalid-key",
                extra={
                    "external_issue_key": external_issue.key,
                    "provider": self.model.provider,
                },
            )
            return

        # Get the project mapping to determine what status to use
        external_project = integration_service.get_integration_external_project(
            organization_id=external_issue.organization_id,
            integration_id=external_issue.integration_id,
            external_id=repo_id,
        )

        log_context = {
            "provider": self.model.provider,
            "integration_id": external_issue.integration_id,
            "is_resolved": is_resolved,
            "issue_key": external_issue.key,
            "repo_id": repo_id,
        }

        if not external_project:
            logger.info("external-project-not-found", extra=log_context)
            return

        desired_state = (
            external_project.resolved_status if is_resolved else external_project.unresolved_status
        )

        try:
            issue_data = client.get_issue(repo_id, issue_num)
        except ApiError as e:
            self.raise_error(e)

        current_state = issue_data.get("state")

        # Don't update if it's already in the desired state
        if current_state == desired_state:
            logger.info(
                "sync_status_outbound.unchanged",
                extra={
                    **log_context,
                    "current_state": current_state,
                    "desired_state": desired_state,
                    "provider": self.model.provider,
                },
            )
            return

        # Update the issue state
        try:
            client.update_issue_status(repo_id, issue_num, desired_state)
            logger.info(
                "sync_status_outbound.success",
                extra={
                    **log_context,
                    "old_state": current_state,
                    "new_state": desired_state,
                    "provider": self.model.provider,
                },
            )
        except ApiError as e:
            self.raise_error(e)

    def get_resolve_sync_action(self, data: Mapping[str, Any]) -> ResolveSyncAction:
        """
        Given webhook data, check whether the GitHub issue status changed.
        GitHub issues only have open/closed state.
        """
        if not self.check_feature_flag():
            return ResolveSyncAction.NOOP

        if data.get("action") == IssueEvenntWebhookActionType.CLOSED.value:
            return ResolveSyncAction.RESOLVE
        elif data.get("action") == IssueEvenntWebhookActionType.REOPENED.value:
            return ResolveSyncAction.UNRESOLVE
        return ResolveSyncAction.NOOP

    def create_comment_attribution(self, user_id, comment_text):
        user = user_service.get_user(user_id)
        username = "Unknown User" if user is None else user.name

        attribution = f"**{username}** wrote:\n\n"
        # GitHub uses markdown blockquotes
        quoted_text = "\n".join(f"> {line}" for line in comment_text.split("\n"))
        return f"{attribution}{quoted_text}"

    def update_comment(self, issue_id, user_id, group_note):
        quoted_comment = self.create_comment_attribution(user_id, group_note.data["text"])

        repo, issue_number = issue_id.rsplit("#", 1)

        return self.get_client().update_comment(
            repo, issue_number, group_note.data["external_id"], {"body": quoted_comment}
        )

    def create_comment(self, issue_id, user_id, group_note):
        # GitHub uses markdown syntax directly without needing special formatting
        comment = group_note.data["text"]
        quoted_comment = self.create_comment_attribution(user_id, comment)

        repo, issue_number = issue_id.rsplit("#", 1)

        return self.get_client().create_comment(repo, issue_number, {"body": quoted_comment})
