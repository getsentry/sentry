from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.integrations.gitea.utils import is_repo_path
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.services.repository import repository_service
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.group import Group
from sentry.shared_integrations.exceptions import (
    ApiError,
    IntegrationError,
    IntegrationFormError,
)
from sentry.silo.base import all_silo_function
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.http import absolute_uri

# Gitea stores an issue title in a `VARCHAR(255)`, and rejects anything longer
# with a 422 that reads as a generic validation failure.
GITEA_ISSUE_TITLE_MAX_LENGTH = 255


class GiteaIssuesSpec(SourceCodeIssueIntegration):
    """
    Creating and linking Gitea issues from a Sentry issue.

    Gitea keys issues on `{owner}/{repo}#{index}`, where the index restarts at 1
    in every repository - so, unlike GitLab's globally unique project ids, the
    repository is part of the key rather than a lookup away from it.
    """

    def _validated_repo(self, repo: str | None, field: str = "repo") -> str:
        """
        A repository the caller may actually address, or a form error.

        The `repo` these methods receive comes from a form field or a query
        parameter, and is interpolated into a `/repos/{repo}/...` route rather
        than sent as a parameter, so a value carrying dot segments would climb
        out of the repository scope entirely (see `has_relative_segments`).
        Ownership is checked on top of shape: a well-formed `owner/name` the
        organization never linked is still not this installation's to read.
        """
        if not repo:
            raise IntegrationFormError({field: "Repository is required"})

        if not is_repo_path(repo):
            raise IntegrationFormError({field: f"Invalid repository name: {repo}"})

        # Through the RPC service rather than the model: the issue-search
        # endpoint runs in control silo, where `Repository` - a region model -
        # is not queryable.
        linked = repository_service.get_repositories(
            organization_id=self.organization_id,
            integration_id=self.model.id,
            providers=[f"integrations:{IntegrationProviderSlug.GITEA.value}"],
            status=ObjectStatus.ACTIVE,
        )
        if not any(linked_repo.name == repo for linked_repo in linked):
            raise IntegrationFormError(
                {field: f"Given repository, {repo}, does not belong to this installation"}
            )

        return repo

    def make_external_key(self, data: Mapping[str, Any]) -> str:
        return "{}#{}".format(data["repo"], data["key"])

    def get_issue_url(self, key: str) -> str:
        repo, _, issue_index = key.partition("#")
        base_url = self.model.metadata["base_url"].rstrip("/")
        return f"{base_url}/{repo}/issues/{issue_index}"

    def get_persisted_default_config_fields(self) -> Sequence[str]:
        return ["repo"]

    def get_allowed_assignees(self, repo: str) -> list[tuple[str, str]]:
        client = self.get_client()
        try:
            response = client.get_assignees(repo)
        except Exception as e:
            self.raise_error(e)

        return [("", "Unassigned")] + [(user["login"], user["login"]) for user in response]

    def get_repo_labels(self, repo: str) -> list[tuple[str, str]]:
        """
        The repository's labels, keyed by id.

        Gitea's create-issue payload takes label *ids* rather than the names
        GitHub accepts, so the id is what the form has to round-trip.
        """
        client = self.get_client()
        try:
            response = client.get_labels(repo)
        except Exception as e:
            self.raise_error(e)

        return sorted(
            ((str(label["id"]), label["name"]) for label in response),
            key=lambda pair: pair[1].lower(),
        )

    @all_silo_function
    def get_create_issue_config(
        self, group: Group | None, user: User | RpcUser, **kwargs: Any
    ) -> list[dict[str, Any]]:
        kwargs["link_referrer"] = "gitea_integration"
        fields = super().get_create_issue_config(group, user, **kwargs)

        params = kwargs.pop("params", {})
        default_repo, repo_choices = self.get_repository_choices(group, params)

        assignees = self.get_allowed_assignees(default_repo) if default_repo else []
        labels = self.get_repo_labels(default_repo) if default_repo else []

        autocomplete_url = reverse(
            "sentry-extensions-gitea-search", args=[self.organization.slug, self.model.id]
        )

        return [
            {
                "name": "repo",
                "label": "Gitea Repository",
                "type": "select",
                "default": default_repo,
                "choices": repo_choices,
                "url": autocomplete_url,
                "updatesForm": True,
                "required": True,
            },
            *fields,
            {
                "name": "assignee",
                "label": "Assignee",
                "default": "",
                "type": "select",
                "required": False,
                "choices": assignees,
            },
            {
                "name": "labels",
                "label": "Labels",
                "default": [],
                "type": "select",
                "multiple": True,
                "required": False,
                "choices": labels,
            },
        ]

    def create_issue(self, data: Mapping[str, Any], **kwargs: Any) -> Mapping[str, Any]:
        client = self.get_client()
        repo = self._validated_repo(data.get("repo"))

        title = data.get("title")
        if not title:
            raise IntegrationFormError({"title": "Title is required"})

        # Truncated rather than refused: the title is generated from the Sentry
        # issue, so a long one is our doing, not something the user can fix in
        # the form.
        if len(title) > GITEA_ISSUE_TITLE_MAX_LENGTH:
            title = title[: GITEA_ISSUE_TITLE_MAX_LENGTH - 3] + "..."

        issue_data: dict[str, Any] = {"title": title, "body": data.get("description", "")}

        if data.get("assignee"):
            issue_data["assignees"] = [data["assignee"]]
        if data.get("labels"):
            # The form round-trips label ids as strings; Gitea only accepts
            # integers here and 422s on anything else.
            try:
                issue_data["labels"] = [int(label) for label in data["labels"]]
            except (TypeError, ValueError):
                raise IntegrationFormError({"labels": "Invalid label selection"})

        try:
            issue = client.create_issue(repo_path=repo, data=issue_data)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        return {
            "key": issue["number"],
            "title": issue["title"],
            "description": issue["body"],
            "url": issue["html_url"],
            "repo": repo,
        }

    def get_link_issue_config(self, group: Group, **kwargs: Any) -> list[dict[str, Any]]:
        params = kwargs.pop("params", {})
        default_repo, repo_choices = self.get_repository_choices(group, params)

        autocomplete_url = reverse(
            "sentry-extensions-gitea-search", args=[group.organization.slug, self.model.id]
        )

        return [
            {
                "name": "repo",
                "label": "Gitea Repository",
                "type": "select",
                "default": default_repo,
                "choices": repo_choices,
                "url": autocomplete_url,
                "required": True,
                "updatesForm": True,
            },
            {
                "name": "externalIssue",
                "label": "Issue",
                "default": "",
                "choices": [],
                "type": "select",
                "url": autocomplete_url,
                "required": True,
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": "Sentry Issue: [{issue_id}]({url})".format(
                    url=absolute_uri(
                        group.get_absolute_url(params={"referrer": "gitea_integration"})
                    ),
                    issue_id=group.qualified_short_id,
                ),
                "type": "textarea",
                "required": False,
                "autosize": True,
                "help": "Leave blank if you don't want to add a comment to the Gitea issue.",
            },
        ]

    def get_issue(self, issue_id: str, **kwargs: Any) -> Mapping[str, Any]:
        data = kwargs["data"]
        repo = self._validated_repo(data.get("repo"))

        issue_index = data.get("externalIssue")
        if not issue_index:
            raise IntegrationFormError({"externalIssue": "Issue number is required"})

        try:
            issue = self.get_client().get_issue(repo_path=repo, issue_index=issue_index)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        return {
            "key": issue["number"],
            "title": issue["title"],
            "description": issue["body"],
            "url": issue["html_url"],
            "repo": repo,
        }

    def after_link_issue(self, external_issue: ExternalIssue, **kwargs: Any) -> None:
        comment = kwargs["data"].get("comment")
        if not comment:
            return

        repo, _, issue_index = external_issue.key.partition("#")
        repo = self._validated_repo(repo)
        if not issue_index:
            raise IntegrationFormError({"externalIssue": "Issue number is required"})

        try:
            self.get_client().create_issue_comment(
                repo_path=repo, issue_index=issue_index, data={"body": comment}
            )
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

    def search_issues(self, query: str | None, **kwargs: Any) -> list[dict[str, Any]]:
        repo = self._validated_repo(kwargs["repo"])
        response = self.get_client().search_issues(repo_path=repo, query=query)
        assert isinstance(response, list)
        return response
