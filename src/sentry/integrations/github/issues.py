from __future__ import annotations

from typing import Any, Mapping, Sequence

from django.urls import reverse

from sentry.integrations.mixins import IssueBasicMixin
from sentry.models import ExternalIssue, Group, User
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.utils.http import absolute_uri


class GitHubIssueBasic(IssueBasicMixin):  # type: ignore
    def make_external_key(self, data: Mapping[str, Any]) -> str:
        return "{}#{}".format(data["repo"], data["key"])

    def get_issue_url(self, key: str) -> str:
        domain_name, user = self.model.metadata["domain_name"].split("/")
        repo, issue_id = key.split("#")
        return f"https://{domain_name}/{repo}/issues/{issue_id}"

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

    def get_create_issue_config(
        self, group: Group, user: User, **kwargs: Any
    ) -> Sequence[Mapping[str, Any]]:
        kwargs["link_referrer"] = "github_integration"
        fields = super().get_create_issue_config(group, user, **kwargs)
        default_repo, repo_choices = self.get_repository_choices(group, **kwargs)

        assignees = self.get_allowed_assignees(default_repo) if default_repo else []

        org = group.organization
        autocomplete_url = reverse(
            "sentry-extensions-github-search", args=[org.slug, self.model.id]
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

    def get_link_issue_config(self, group: Group, **kwargs: Any) -> Sequence[Mapping[str, Any]]:
        default_repo, repo_choices = self.get_repository_choices(group, **kwargs)

        org = group.organization
        autocomplete_url = reverse(
            "sentry-extensions-github-search", args=[org.slug, self.model.id]
        )

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
                "default": "Sentry issue: [{issue_id}]({url})".format(
                    url=absolute_uri(
                        group.get_absolute_url(params={"referrer": "github_integration"})
                    ),
                    issue_id=group.qualified_short_id,
                ),
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
            raise self.raise_error(e)

        users = tuple((u["login"], u["login"]) for u in response)

        return (("", "Unassigned"),) + users

    def get_repo_issues(self, repo: str) -> Sequence[tuple[str, str]]:
        client = self.get_client()
        try:
            response = client.get_issues(repo)
        except Exception as e:
            raise self.raise_error(e)

        issues = tuple((i["number"], "#{} {}".format(i["number"], i["title"])) for i in response)

        return issues
