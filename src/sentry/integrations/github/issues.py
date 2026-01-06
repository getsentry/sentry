from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from operator import attrgetter
from typing import Any, NoReturn

from django.urls import reverse

from sentry.constants import ObjectStatus
from sentry.integrations.mixins.issues import MAX_CHAR
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.issues.grouptype import GroupCategory
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.repository import Repository
from sentry.organizations.services.organization.service import organization_service
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.shared_integrations.exceptions import (
    ApiError,
    IntegrationConfigurationError,
    IntegrationError,
    IntegrationFormError,
    IntegrationResourceNotFoundError,
)
from sentry.silo.base import all_silo_function
from sentry.users.models.identity import Identity
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.http import absolute_uri
from sentry.utils.strings import truncatechars

PAGE_NUMBER_LIMIT = 1


class GitHubIssuesSpec(SourceCodeIssueIntegration):
    def raise_error(self, exc: Exception, identity: Identity | None = None) -> NoReturn:
        if isinstance(exc, ApiError):
            if exc.code == 422:
                invalid_fields = {}
                if exc.json is not None:
                    for e in exc.json.get("errors", []):
                        field = e.get("field", "unknown field")
                        code = e.get("code", "invalid")
                        value = e.get("value", "unknown value")

                        invalid_fields[field] = f"Got {code} value: {value} for field: {field}"
                        raise IntegrationFormError(invalid_fields) from exc
                    raise IntegrationFormError(
                        {"detail": "Some given field was misconfigured"}
                    ) from exc
            elif exc.code == 410:
                raise IntegrationConfigurationError(
                    "Issues are disabled for this repository, please check your repository permissions"
                ) from exc
            elif exc.code == 404:
                raise IntegrationResourceNotFoundError from exc
            elif exc.code == 403:
                if exc.json is not None:
                    detail = exc.json.get("message")
                    if detail:
                        raise IntegrationConfigurationError(detail) from exc

                raise IntegrationConfigurationError(
                    "You are not authorized to create issues in this repository. Please check your repository permissions."
                ) from exc

        raise super().raise_error(exc=exc, identity=identity)

    def make_external_key(self, data: Mapping[str, Any]) -> str:
        return "{}#{}".format(data["repo"], data["key"])

    def get_issue_url(self, key: str) -> str:
        domain_name, user = self.model.metadata["domain_name"].split("/")
        repo, issue_id = key.split("#")
        return f"https://{domain_name}/{repo}/issues/{issue_id}"

    def get_feedback_issue_body(self, occurrence: IssueOccurrence) -> str:
        messages = [
            evidence for evidence in occurrence.evidence_display if evidence.name == "message"
        ]
        others = [
            evidence for evidence in occurrence.evidence_display if evidence.name != "message"
        ]

        body = ""
        for message in messages:
            body += message.value
            body += "\n\n"

        body += "|  |  |\n"
        body += "| ------------- | --------------- |\n"
        for evidence in sorted(others, key=attrgetter("important"), reverse=True):
            body += f"| **{evidence.name}** | {evidence.value} |\n"

        return body.rstrip("\n")  # remove the last new line

    def get_generic_issue_body(self, occurrence: IssueOccurrence) -> str:
        body = "|  |  |\n"
        body += "| ------------- | --------------- |\n"
        for evidence in sorted(
            occurrence.evidence_display, key=attrgetter("important"), reverse=True
        ):
            body += f"| **{evidence.name}** | {truncatechars(evidence.value, MAX_CHAR)} |\n"

        return body[:-2]

    def get_group_description(self, group: Group, event: Event | GroupEvent, **kwargs: Any) -> str:
        output = self.get_group_link(group, **kwargs)

        if isinstance(event, GroupEvent) and event.occurrence is not None:
            body = ""
            if group.issue_category == GroupCategory.FEEDBACK:
                body = self.get_feedback_issue_body(event.occurrence)
            else:
                body = self.get_generic_issue_body(event.occurrence)
            output.extend([body])
        else:
            body = self.get_group_body(group, event)
            if body:
                output.extend(["", "```", body, "```"])
        return "\n".join(output)

    def after_link_issue(self, external_issue: ExternalIssue, **kwargs: Any) -> None:
        data = kwargs["data"]
        client = self.get_client()

        repo, issue_num = external_issue.key.split("#")
        if not repo:
            raise IntegrationFormError({"repo": "Repository is required"})

        if not issue_num:
            raise IntegrationFormError({"externalIssue": "Issue number is required"})

        comment = data.get("comment")
        if comment:
            try:
                client.create_comment(repo=repo, issue_id=issue_num, data={"body": comment})
            except ApiError as e:
                raise IntegrationError(self.message_from_error(e))

    def get_persisted_default_config_fields(self) -> Sequence[str]:
        return ["repo"]

    def create_default_repo_choice(self, default_repo: str) -> tuple[str, str]:
        return default_repo, default_repo.split("/")[1]

    @all_silo_function
    def get_create_issue_config(
        self, group: Group | None, user: User | RpcUser, **kwargs: Any
    ) -> list[dict[str, Any]]:
        """
        We use the `group` to get three things: organization_slug, project
        defaults, and default title and description. In the case where we're
        getting `createIssueConfig` from GitHub for Ticket Rules, we don't know
        the issue group beforehand.

        :param group: (Optional) Group model.
        :param user: User model.
        :param kwargs: (Optional) Object
            * params: (Optional) Object
        :return:
        """
        kwargs["link_referrer"] = "github_integration"

        if group:
            fields = super().get_create_issue_config(group, user, **kwargs)
            org = group.organization
        else:
            fields = []
            org_context = organization_service.get_organization_by_id(
                id=self.organization_id, include_projects=False, include_teams=False
            )
            assert org_context is not None
            org = org_context.organization

        params = kwargs.pop("params", {})
        default_repo, repo_choices = self.get_repository_choices(group, params, PAGE_NUMBER_LIMIT)

        assignees = self.get_allowed_assignees(default_repo) if default_repo else []
        labels: Sequence[tuple[str, str]] = []
        if default_repo:
            owner, repo = default_repo.split("/")
            labels = self.get_repo_labels(owner, repo)

        autocomplete_url = reverse(
            "sentry-integration-github-search", args=[org.slug, self.model.id]
        )

        return [
            {
                "name": "repo",
                "label": "GitHub Repository",
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
        repo = data.get("repo")
        if not repo:
            raise IntegrationFormError({"repo": "Repository is required"})

        # Check the repository belongs to the integration
        if not Repository.objects.filter(
            name=repo,
            integration_id=self.model.id,
            organization_id=self.organization_id,
            status=ObjectStatus.ACTIVE,
        ).exists():
            raise IntegrationFormError(
                {"repo": f"Given repository, {repo} does not belong to this installation"}
            )

        # Create clean issue data with required fields
        if not data.get("title"):
            raise IntegrationFormError({"title": "Title is required"})

        if not data.get("description"):
            raise IntegrationFormError({"description": "Description is required"})

        issue_data = {
            "title": data["title"],
            "body": data["description"],
        }

        # Only include optional fields if they have valid values
        if data.get("assignee"):
            issue_data["assignee"] = data["assignee"]
        if data.get("labels"):
            issue_data["labels"] = data["labels"]

        try:
            issue = client.create_issue(repo=repo, data=issue_data)
        except ApiError as e:
            self.raise_error(e)

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

        org = group.organization
        autocomplete_url = reverse(
            "sentry-integration-github-search", args=[org.slug, self.model.id]
        )

        def get_linked_issue_comment_prefix(group: Group) -> str:
            if group.issue_category == GroupCategory.FEEDBACK:
                return "Sentry Feedback"
            else:
                return "Sentry Issue"

        def get_default_comment(group: Group) -> str:
            prefix = get_linked_issue_comment_prefix(group)
            url = group.get_absolute_url(params={"referrer": "github_integration"})
            issue_short_id = group.qualified_short_id

            return f"{prefix}: [{issue_short_id}]({absolute_uri(url)})"

        return [
            {
                "name": "repo",
                "label": "GitHub Repository",
                "type": "select",
                "default": default_repo,
                "choices": repo_choices,
                "url": autocomplete_url,
                "required": True,
                "updatesForm": True,
            },
            {
                "name": "externalIssue",
                "label": "Issue Number or Title",
                "default": "",
                "choices": [],
                "type": "select",
                "url": autocomplete_url,
                "required": True,
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": get_default_comment(group),
                "type": "textarea",
                "required": False,
                "autosize": True,
                "help": "Leave blank if you don't want to add a comment to the GitHub issue.",
            },
        ]

    def get_issue(self, issue_id: str, **kwargs: Any) -> Mapping[str, Any]:
        data = kwargs["data"]
        repo = data.get("repo")
        issue_num = data.get("externalIssue")
        client = self.get_client()

        if not repo:
            raise IntegrationFormError({"repo": "Repository is required"})

        if not Repository.objects.filter(
            name=repo,
            integration_id=self.model.id,
            organization_id=self.organization_id,
            status=ObjectStatus.ACTIVE,
        ).exists():
            raise IntegrationFormError(
                {"repo": f"Given repository, {repo} does not belong to this installation"}
            )

        if not issue_num:
            raise IntegrationFormError({"externalIssue": "Issue number is required"})

        try:
            issue = client.get_issue(repo, issue_num)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        return {
            "key": issue["number"],
            "title": issue["title"],
            "description": issue["body"],
            "url": issue["html_url"],
            "repo": repo,
        }

    def get_allowed_assignees(self, repo: str) -> Sequence[tuple[str, str]]:
        client = self.get_client()
        try:
            response = client.get_assignees(repo)
        except Exception as e:
            self.raise_error(e)

        users = tuple((u["login"], u["login"]) for u in response)

        return (("", "Unassigned"),) + users

    def get_repo_labels(self, owner: str, repo: str) -> Sequence[tuple[str, str]]:
        client = self.get_client()
        try:
            response = client.get_labels(owner, repo)
        except Exception as e:
            self.raise_error(e)

        def natural_sort_pair(pair: tuple[str, str]) -> list[str | int]:
            return [
                int(text) if text.isdecimal() else text.lower()
                for text in re.split("([0-9]+)", pair[0])
            ]

        # sort alphabetically
        labels = tuple(
            sorted([(label["name"], label["name"]) for label in response], key=natural_sort_pair)
        )

        return labels
