from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from operator import attrgetter
from typing import Any

from django.urls import reverse

from sentry.eventstore.models import Event, GroupEvent
from sentry.integrations.mixins.issues import MAX_CHAR
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.organizations.services.organization.service import organization_service
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.silo.base import all_silo_function
from sentry.users.models.user import User
from sentry.utils.http import absolute_uri
from sentry.utils.strings import truncatechars


class GitHubIssuesSpec(SourceCodeIssueIntegration):
    def make_external_key(self, data: Mapping[str, Any]) -> str:
        return "{}#{}".format(data["repo"], data["key"])

    def get_issue_url(self, key: str) -> str:
        domain_name, user = self.model.metadata["domain_name"].split("/")
        repo, issue_id = key.split("#")
        return f"https://{domain_name}/{repo}/issues/{issue_id}"

    def get_feedback_issue_body(self, event: GroupEvent) -> str:
        messages = [
            evidence for evidence in event.occurrence.evidence_display if evidence.name == "message"
        ]
        others = [
            evidence for evidence in event.occurrence.evidence_display if evidence.name != "message"
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

    def get_generic_issue_body(self, event: GroupEvent) -> str:
        body = "|  |  |\n"
        body += "| ------------- | --------------- |\n"
        for evidence in sorted(
            event.occurrence.evidence_display, key=attrgetter("important"), reverse=True
        ):
            body += f"| **{evidence.name}** | {truncatechars(evidence.value, MAX_CHAR)} |\n"

        return body[:-2]

    def get_group_description(self, group: Group, event: Event | GroupEvent, **kwargs: Any) -> str:
        output = self.get_group_link(group, **kwargs)

        if isinstance(event, GroupEvent) and event.occurrence is not None:
            body = ""
            if group.issue_category == GroupCategory.FEEDBACK:
                body = self.get_feedback_issue_body(event)
            else:
                body = self.get_generic_issue_body(event)
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
            raise IntegrationError("repo must be provided")

        if not issue_num:
            raise IntegrationError("issue number must be provided")

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
        self, group: Group | None, user: User, **kwargs: Any
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
            org = org_context.organization

        params = kwargs.pop("params", {})
        default_repo, repo_choices = self.get_repository_choices(group, params, **kwargs)

        assignees = self.get_allowed_assignees(default_repo) if default_repo else []
        labels = self.get_repo_labels(default_repo) if default_repo else []

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
            raise IntegrationError("repo kwarg must be provided")

        try:
            issue = client.create_issue(
                repo=repo,
                data={
                    "title": data["title"],
                    "body": data["description"],
                    "assignee": data.get("assignee"),
                    "labels": data.get("labels"),
                },
            )
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
        default_repo, repo_choices = self.get_repository_choices(group, params, **kwargs)

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
            raise IntegrationError("repo must be provided")

        if not issue_num:
            raise IntegrationError("issue must be provided")

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

    def get_repo_issues(self, repo: str) -> Sequence[tuple[str, str]]:
        client = self.get_client()
        try:
            response = client.get_issues(repo)
        except Exception as e:
            self.raise_error(e)

        issues = tuple((i["number"], "#{} {}".format(i["number"], i["title"])) for i in response)

        return issues

    def get_repo_labels(self, repo: str) -> Sequence[tuple[str, str]]:
        client = self.get_client()
        try:
            response = client.get_labels(repo)
        except Exception as e:
            self.raise_error(e)

        def natural_sort_pair(pair: tuple[str, str]) -> str | int:
            return [
                int(text) if text.isdecimal() else text for text in re.split("([0-9]+)", pair[0])
            ]

        # sort alphabetically
        labels = tuple(
            sorted([(label["name"], label["name"]) for label in response], key=natural_sort_pair)
        )

        return labels
