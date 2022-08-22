from rest_framework.request import Request

from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.plugins.bases.issue2 import IssuePlugin2
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.http import absolute_uri
from sentry_plugins.base import CorePluginMixin
from sentry_plugins.utils import get_secret_field_config

from .client import GitLabClient


class GitLabPlugin(CorePluginMixin, IssuePlugin2):
    description = "Integrate GitLab issues by linking a repository to a project"
    slug = "gitlab"
    title = "GitLab"
    conf_title = title
    conf_key = "gitlab"
    required_field = "gitlab_url"
    feature_descriptions = [
        FeatureDescription(
            """
            Track commits and releases (learn more
            [here](https://docs.sentry.io/learn/releases/))
            """,
            IntegrationFeatures.COMMITS,
        ),
        FeatureDescription(
            """
            Resolve Sentry issues via GitLab commits and merge requests by
            including `Fixes PROJ-ID` in the message
            """,
            IntegrationFeatures.COMMITS,
        ),
        FeatureDescription(
            """
            Create GitLab issues from Sentry
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
        FeatureDescription(
            """
            Link Sentry issues to existing GitLab issues
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
    ]

    def is_configured(self, request: Request, project, **kwargs):
        return bool(
            self.get_option("gitlab_repo", project)
            and self.get_option("gitlab_token", project)
            and self.get_option("gitlab_url", project)
        )

    def get_new_issue_fields(self, request: Request, group, event, **kwargs):
        fields = super().get_new_issue_fields(request, group, event, **kwargs)
        return [
            {
                "name": "repo",
                "label": "Repository",
                "default": self.get_option("gitlab_repo", group.project),
                "type": "text",
                "readonly": True,
            },
            *fields,
            {
                "name": "assignee",
                "label": "Assignee",
                "default": "",
                "type": "select",
                "required": False,
                "choices": self.get_allowed_assignees(request, group),
            },
            {
                "name": "labels",
                "label": "Labels",
                "default": self.get_option("gitlab_labels", group.project),
                "type": "text",
                "placeholder": "e.g. high, bug",
                "required": False,
            },
        ]

    def get_link_existing_issue_fields(self, request: Request, group, event, **kwargs):
        return [
            {
                "name": "issue_id",
                "label": "Issue #",
                "default": "",
                "placeholder": "e.g. 1543",
                "type": "text",
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": absolute_uri(
                    group.get_absolute_url(params={"referrer": "gitlab_plugin"})
                ),
                "type": "textarea",
                "help": ("Leave blank if you don't want to " "add a comment to the GitLab issue."),
                "required": False,
            },
        ]

    def get_allowed_assignees(self, request: Request, group):
        repo = self.get_option("gitlab_repo", group.project)
        client = self.get_client(group.project)
        try:
            response = client.list_project_members(repo)
        except ApiError as e:
            raise self.raise_error(e)
        users = tuple((u["id"], u["username"]) for u in response)

        return (("", "(Unassigned)"),) + users

    def get_new_issue_title(self, **kwargs):
        return "Create GitLab Issue"

    def get_client(self, project):
        url = self.get_option("gitlab_url", project).rstrip("/")
        token = self.get_option("gitlab_token", project)

        return GitLabClient(url, token)

    def create_issue(self, request: Request, group, form_data, **kwargs):
        repo = self.get_option("gitlab_repo", group.project)

        client = self.get_client(group.project)

        try:
            response = client.create_issue(
                repo,
                {
                    "title": form_data["title"],
                    "description": form_data["description"],
                    "labels": form_data.get("labels"),
                    "assignee_id": form_data.get("assignee"),
                },
            )
        except Exception as e:
            raise self.raise_error(e)

        return response["iid"]

    def link_issue(self, request: Request, group, form_data, **kwargs):
        client = self.get_client(group.project)
        repo = self.get_option("gitlab_repo", group.project)
        try:
            issue = client.get_issue(repo=repo, issue_id=form_data["issue_id"])
        except Exception as e:
            raise self.raise_error(e)

        comment = form_data.get("comment")
        if comment:
            try:
                client.create_note(repo=repo, issue_iid=issue["iid"], data={"body": comment})
            except Exception as e:
                raise self.raise_error(e)

        return {"title": issue["title"]}

    def get_issue_label(self, group, issue_id, **kwargs):
        return f"GL-{issue_id}"

    def get_issue_url(self, group, issue_iid, **kwargs):
        url = self.get_option("gitlab_url", group.project).rstrip("/")
        repo = self.get_option("gitlab_repo", group.project)

        return f"{url}/{repo}/issues/{issue_iid}"

    def get_configure_plugin_fields(self, request: Request, project, **kwargs):
        gitlab_token = self.get_option("gitlab_token", project)
        secret_field = get_secret_field_config(
            gitlab_token, "Enter your GitLab API token.", include_prefix=True
        )
        secret_field.update(
            {
                "name": "gitlab_token",
                "label": "Access Token",
                "placeholder": "e.g. g5DWFtLzaztgYFrqhVfE",
            }
        )

        return [
            {
                "name": "gitlab_url",
                "label": "GitLab URL",
                "type": "url",
                "default": "https://gitlab.com",
                "placeholder": "e.g. https://gitlab.example.com",
                "required": True,
                "help": "Enter the URL for your GitLab server.",
            },
            secret_field,
            {
                "name": "gitlab_repo",
                "label": "Repository Name",
                "type": "text",
                "placeholder": "e.g. getsentry/sentry",
                "required": True,
                "help": "Enter your repository name, including the owner.",
            },
            {
                "name": "gitlab_labels",
                "label": "Issue Labels",
                "type": "text",
                "placeholder": "e.g. high, bug",
                "required": False,
                "help": "Enter the labels you want to auto assign to new issues.",
            },
        ]

    def validate_config(self, project, config, actor=None):
        url = config["gitlab_url"].rstrip("/")
        token = config["gitlab_token"]
        repo = config["gitlab_repo"]

        client = GitLabClient(url, token)
        try:
            client.get_project(repo)
        except Exception as e:
            raise self.raise_error(e)
        return config
