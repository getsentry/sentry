from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from django.urls import reverse

from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.models.group import Group
from sentry.shared_integrations.exceptions import ApiError, IntegrationFormError
from sentry.silo.base import all_silo_function
from sentry.users.models.user import User

ISSUE_TYPES = (
    ("bug", "Bug"),
    ("enhancement", "Enhancement"),
    ("proposal", "Proposal"),
    ("task", "Task"),
)

PRIORITIES = (
    ("trivial", "Trivial"),
    ("minor", "Minor"),
    ("major", "Major"),
    ("critical", "Critical"),
    ("blocker", "Blocker"),
)


class BitbucketIssuesSpec(SourceCodeIssueIntegration):
    def get_issue_url(self, key: str) -> str:
        repo, issue_id = key.split("#")
        return f"https://bitbucket.org/{repo}/issues/{issue_id}"

    def get_persisted_default_config_fields(self) -> Sequence[str]:
        return ["repo"]

    @all_silo_function
    def get_create_issue_config(
        self, group: Group | None, user: User, **kwargs
    ) -> list[dict[str, Any]]:
        kwargs["link_referrer"] = "bitbucket_integration"

        fields = super().get_create_issue_config(group, user, **kwargs)
        params = kwargs.pop("params", {})
        default_repo, repo_choices = self.get_repository_choices(group, params, **kwargs)

        assert group is not None
        org = group.organization
        autocomplete_url = reverse(
            "sentry-extensions-bitbucket-search", args=[org.slug, self.model.id]
        )

        return [
            {
                "name": "repo",
                "required": True,
                "updatesForm": True,
                "type": "select",
                "url": autocomplete_url,
                "choices": repo_choices,
                "default": default_repo,
                "label": "Bitbucket Repository",
            },
            *fields,
            {
                "name": "issue_type",
                "label": "Issue type",
                "default": ISSUE_TYPES[0][0],
                "type": "select",
                "choices": ISSUE_TYPES,
            },
            {
                "name": "priority",
                "label": "Priority",
                "default": PRIORITIES[0][0],
                "type": "select",
                "choices": PRIORITIES,
            },
        ]

    def get_link_issue_config(self, group: Group, **kwargs) -> list[dict[str, Any]]:
        params = kwargs.pop("params", {})
        default_repo, repo_choices = self.get_repository_choices(group, params, **kwargs)

        org = group.organization
        autocomplete_url = reverse(
            "sentry-extensions-bitbucket-search", args=[org.slug, self.model.id]
        )

        return [
            {
                "name": "repo",
                "required": True,
                "updatesForm": True,
                "type": "select",
                "url": autocomplete_url,
                "choices": repo_choices,
                "default": default_repo,
                "label": "Bitbucket Repository",
            },
            {
                "name": "externalIssue",
                "label": "Issue",
                "default": "",
                "type": "select",
                "required": True,
                "url": autocomplete_url,
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": "",
                "type": "textarea",
                "required": False,
                "help": (
                    "Leave blank if you don't want to " "add a comment to the Bitbucket issue."
                ),
            },
        ]

    def create_issue(self, data, **kwargs):
        client = self.get_client()
        if not data.get("repo"):
            raise IntegrationFormError({"repo": ["Repository is required"]})

        data["content"] = {"raw": data["description"]}
        del data["description"]

        try:
            issue = client.create_issue(data.get("repo"), data)
        except ApiError as e:
            self.raise_error(e)

        return {
            "key": issue["id"],
            "title": issue["title"],
            "description": issue["content"]["html"],  # users content rendered as html
            "repo": data.get("repo"),
        }

    def get_issue(self, issue_id, **kwargs):
        client = self.get_client()
        repo = kwargs["data"].get("repo")
        issue = client.get_issue(repo, issue_id)
        return {
            "key": issue["id"],
            "title": issue["title"],
            "description": issue["content"]["html"],  # users content rendered as html
            "repo": repo,
        }

    def make_external_key(self, data):
        return "{}#{}".format(data["repo"], data["key"])

    def after_link_issue(self, external_issue, **kwargs):
        data = kwargs["data"]
        client = self.get_client()

        repo, issue_num = external_issue.key.split("#")

        if not repo:
            raise IntegrationFormError({"repo": "Repository is required"})
        if not issue_num:
            raise IntegrationFormError({"externalIssue": "Issue ID is required"})

        comment = data.get("comment")
        if comment:
            try:
                client.create_comment(
                    repo=repo, issue_id=issue_num, data={"content": {"raw": comment}}
                )
            except ApiError as e:
                self.raise_error(e)

    def search_issues(self, query: str | None, **kwargs) -> dict[str, Any]:
        client = self.get_client()
        repo = kwargs["repo"]
        resp = client.search_issues(repo, query)
        assert isinstance(resp, dict)
        return resp
