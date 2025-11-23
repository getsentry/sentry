from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping
from typing import Any
from urllib.parse import quote

from django.utils.translation import gettext_lazy as _

from sentry import features
from sentry.integrations.mixins.issues import IssueSyncIntegration, ResolveSyncAction
from sentry.integrations.models.external_actor import ExternalActor
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.services.integration import integration_service
from sentry.integrations.types import EXTERNAL_PROVIDERS_REVERSE, ExternalProviderEnum
from sentry.organizations.services.organization import organization_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service

logger = logging.getLogger("sentry.integrations.gitlab.issue_sync")


class GitlabIssueSyncSpec(IssueSyncIntegration):
    comment_key = "sync_comments"
    outbound_assignee_key = "sync_forward_assignment"
    inbound_assignee_key = "sync_reverse_assignment"

    def check_feature_flag(self) -> bool:
        """
        A temporary method so we can gate GitLab project management features.
        """
        return features.has(
            "organizations:integrations-gitlab-project-management", self.organization
        )

    def split_external_issue_key(
        self, external_issue_key: str
    ) -> tuple[str, str] | tuple[None, None]:
        """
        Split the external issue key into project path and issue iid.
        Format is "{domain_name}:{path_with_namespace}#{issue_iid}"
        """
        try:
            _, project_and_issue_iid = external_issue_key.split(":", 1)
            project_id, issue_iid = project_and_issue_iid.split("#")

            return project_id, issue_iid
        except ValueError:
            logger.exception(
                "split-external-key.invalid-format",
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
        Propagate a sentry issue's assignee to a linked GitLab issue's assignee.
        If assign=True, we're assigning the issue. Otherwise, deassign.
        """
        client = self.get_client()

        project_id, issue_iid = self.split_external_issue_key(external_issue.key)

        if not project_id or not issue_iid:
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

        gitlab_user_id = None

        # If we're assigning and have a user, find their GitLab user ID
        if user and assign:
            # Check if user has a GitLab identity linked
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

            # Strip the @ from the username stored in external_name
            gitlab_username = external_actor.external_name.lstrip("@")

            # Search for the GitLab user by username to get their user ID
            try:
                users = client.search_users(gitlab_username)
                if not users or len(users) == 0:
                    logger.warning(
                        "assignee-outbound.gitlab-user-not-found",
                        extra={
                            "provider": self.model.provider,
                            "integration_id": external_issue.integration_id,
                            "gitlab_username": gitlab_username,
                        },
                    )
                    return

                # Take the first matching user (exact username match)
                gitlab_user = users[0]
                gitlab_user_id = gitlab_user["id"]

                logger.info(
                    "assignee-outbound.gitlab-user-found",
                    extra={
                        "provider": self.model.provider,
                        "integration_id": external_issue.integration_id,
                        "gitlab_username": gitlab_username,
                        "gitlab_user_id": gitlab_user_id,
                    },
                )
            except ApiError as e:
                logger.warning(
                    "assignee-outbound.gitlab-user-search-failed",
                    extra={
                        "provider": self.model.provider,
                        "integration_id": external_issue.integration_id,
                        "gitlab_username": gitlab_username,
                        "error": str(e),
                    },
                )
                return

        # Update GitLab issue assignees
        try:
            data = {"assignee_ids": [gitlab_user_id] if gitlab_user_id else []}
            # URL-encode project_id since it's a path_with_namespace (e.g., "owner/repo")
            encoded_project_id = quote(project_id, safe="")
            client.update_issue_assignees(encoded_project_id, issue_iid, data)
        except Exception as e:
            self.raise_error(e)

    def sync_status_outbound(
        self, external_issue: ExternalIssue, is_resolved: bool, project_id: int
    ) -> None:
        """
        Propagate a sentry issue's status to a linked GitLab issue's status.
        For GitLab, we only support opened/closed states.
        """
        raise NotImplementedError

    def get_resolve_sync_action(self, data: Mapping[str, Any]) -> ResolveSyncAction:
        """
        Given webhook data, check whether the GitLab issue status changed.
        GitLab issues have opened/closed state.
        """
        return ResolveSyncAction.NOOP

    def get_config_data(self):
        config = self.org_integration.config
        project_mappings = IntegrationExternalProject.objects.filter(
            organization_integration_id=self.org_integration.id
        )
        sync_status_forward = {}

        for pm in project_mappings:
            sync_status_forward[pm.external_id] = {
                "on_unresolve": pm.unresolved_status,
                "on_resolve": pm.resolved_status,
            }
        config["sync_status_forward"] = sync_status_forward
        return config

    def _get_organization_config_default_values(self) -> list[dict[str, Any]]:
        """
        Return configuration options for the GitLab integration.
        """
        config: list[dict[str, Any]] = []

        if self.check_feature_flag():
            config.extend(
                [
                    {
                        "name": self.inbound_assignee_key,
                        "type": "boolean",
                        "label": _("Sync GitLab Assignment to Sentry"),
                        "help": _(
                            "When an issue is assigned in GitLab, assign its linked Sentry issue to the same user."
                        ),
                        "default": False,
                    },
                    {
                        "name": self.outbound_assignee_key,
                        "type": "boolean",
                        "label": _("Sync Sentry Assignment to GitLab"),
                        "help": _(
                            "When an issue is assigned in Sentry, assign its linked GitLab issue to the same user."
                        ),
                        "default": False,
                    },
                    {
                        "name": self.comment_key,
                        "type": "boolean",
                        "label": _("Sync Sentry Comments to GitLab"),
                        "help": _("Post comments from Sentry issues to linked GitLab issues"),
                    },
                ]
            )

        return config

    def get_organization_config(self) -> list[dict[str, Any]]:
        """
        Return configuration options for the GitLab integration.
        """
        config = self._get_organization_config_default_values()

        context = organization_service.get_organization_by_id(
            id=self.organization_id, include_projects=False, include_teams=False
        )
        assert context, "organizationcontext must exist to get org"
        organization = context.organization

        has_issue_sync = features.has("organizations:integrations-issue-sync", organization)

        if not has_issue_sync:
            for field in config:
                field["disabled"] = True
                field["disabledReason"] = _(
                    "Your organization does not have access to this feature"
                )

        return config

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        """
        Update the configuration field for an organization integration.
        """
        if not self.org_integration:
            return

        config = self.org_integration.config

        config.update(data)
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config=config,
        )
        if org_integration is not None:
            self.org_integration = org_integration

    def create_comment_attribution(self, user_id, comment_text):
        user = user_service.get_user(user_id)
        username = "Unknown User" if user is None else user.name

        attribution = f"**{username}** wrote:\n\n"
        quoted_text = "\n".join(f"> {line}" for line in comment_text.split("\n"))
        return f"{attribution}{quoted_text}"

    def update_comment(self, issue_id, user_id, group_note):
        quoted_comment = self.create_comment_attribution(user_id, group_note.data["text"])

        project_id, issue_iid = self.split_external_issue_key(issue_id)

        if not project_id or not issue_iid:
            logger.error(
                "update-comment.invalid-key",
                extra={
                    "provider": self.model.provider,
                    "external_issue_key": issue_id,
                },
            )
            return None

        encoded_project_id = quote(project_id, safe="")

        return self.get_client().update_comment(
            encoded_project_id,
            issue_iid,
            group_note.data["external_id"],
            {"body": quoted_comment},
        )

    def create_comment(self, issue_id, user_id, group_note):
        comment = group_note.data["text"]
        quoted_comment = self.create_comment_attribution(user_id, comment)

        project_id, issue_iid = self.split_external_issue_key(issue_id)

        if not project_id or not issue_iid:
            logger.error(
                "create-comment.invalid-key",
                extra={
                    "provider": self.model.provider,
                    "external_issue_key": issue_id,
                },
            )
            return None

        encoded_project_id = quote(project_id, safe="")

        return self.get_client().create_comment(
            encoded_project_id, issue_iid, {"body": quoted_comment}
        )
