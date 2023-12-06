import re
from typing import Any, Dict, List, Mapping, Sequence

from django.urls import reverse

from sentry.integrations.mixins import IssueBasicMixin
from sentry.models.group import Group
from sentry.models.user import User
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized, IntegrationError
from sentry.utils.http import absolute_uri

ISSUE_EXTERNAL_KEY_FORMAT = re.compile(r".+:(.+)#(.+)")


class GitlabIssueBasic(IssueBasicMixin):
    def make_external_key(self, data):
        return "{}:{}".format(self.model.metadata["domain_name"], data["key"])

    def get_issue_url(self, key):
        match = ISSUE_EXTERNAL_KEY_FORMAT.match(key)
        project, issue_id = match.group(1), match.group(2)
        return "{}/{}/issues/{}".format(self.model.metadata["base_url"], project, issue_id)

    def get_persisted_default_config_fields(self) -> Sequence[str]:
        return ["project"]

    def get_projects_and_default(self, group: Group, params: Mapping[str, Any], **kwargs):
        defaults = self.get_project_defaults(group.project_id)

        # XXX: In GitLab repositories are called projects but get_repository_choices
        # expects the param to be called 'repo', so we need to rename it here.
        # Django QueryDicts are immutable, so we need to copy it first.
        params = params.copy()
        params["repo"] = params.get("project") or defaults.get("project")

        default_project, project_choices = self.get_repository_choices(group, params, **kwargs)
        return default_project, project_choices

    def create_default_repo_choice(self, default_repo):
        client = self.get_client()
        try:
            # default_repo should be the project_id
            project = client.get_project(default_repo)
        except (ApiError, ApiUnauthorized):
            return ("", "")
        return (project["id"], project["name_with_namespace"])

    def get_create_issue_config(self, group: Group, user: User, **kwargs) -> List[Dict[str, Any]]:
        kwargs["link_referrer"] = "gitlab_integration"
        fields = super().get_create_issue_config(group, user, **kwargs)
        params = kwargs.pop("params", {})
        default_project, project_choices = self.get_projects_and_default(group, params, **kwargs)

        org = group.organization
        autocomplete_url = reverse(
            "sentry-extensions-gitlab-search", args=[org.slug, self.model.id]
        )

        return [
            {
                "name": "project",
                "label": "GitLab Project",
                "type": "select",
                "url": autocomplete_url,
                "choices": project_choices,
                "defaultValue": default_project,
                "required": True,
            },
            *fields,
        ]

    def create_issue(self, data, **kwargs):
        client = self.get_client()

        project_id = data.get("project")

        if not project_id:
            raise IntegrationError("project kwarg must be provided")

        try:
            issue = client.create_issue(
                project=project_id,
                data={"title": data["title"], "description": data["description"]},
            )
            project = client.get_project(project_id)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        project_and_issue_iid = "{}#{}".format(project["path_with_namespace"], issue["iid"])
        return {
            "key": project_and_issue_iid,
            "title": issue["title"],
            "description": issue["description"],
            "url": issue["web_url"],
            "project": project_id,
            "metadata": {"display_name": project_and_issue_iid},
        }

    def after_link_issue(self, external_issue, **kwargs):
        data = kwargs["data"]
        project_id, issue_id = data.get("externalIssue", "").split("#")
        if not (project_id and issue_id):
            raise IntegrationError("Project and Issue id must be provided")

        client = self.get_client()
        comment = data.get("comment")
        if not comment:
            return

        try:
            client.create_issue_comment(
                project_id=project_id, issue_id=issue_id, data={"body": comment}
            )
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

    def get_link_issue_config(self, group: Group, **kwargs) -> List[Dict[str, Any]]:
        params = kwargs.pop("params", {})
        default_project, project_choices = self.get_projects_and_default(group, params, **kwargs)

        org = group.organization
        autocomplete_url = reverse(
            "sentry-extensions-gitlab-search", args=[org.slug, self.model.id]
        )

        return [
            {
                "name": "project",
                "label": "GitLab Project",
                "type": "select",
                "default": default_project,
                "choices": project_choices,
                "url": autocomplete_url,
                "updatesForm": True,
                "required": True,
            },
            {
                "name": "externalIssue",
                "label": "Issue",
                "default": "",
                "type": "select",
                "url": autocomplete_url,
                "required": True,
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": "Sentry issue: [{issue_id}]({url})".format(
                    url=absolute_uri(
                        group.get_absolute_url(params={"referrer": "gitlab_integration"})
                    ),
                    issue_id=group.qualified_short_id,
                ),
                "type": "textarea",
                "required": False,
                "help": ("Leave blank if you don't want to " "add a comment to the GitLab issue."),
            },
        ]

    def get_issue(self, issue_id, **kwargs):
        project_id, issue_num = issue_id.split("#")
        client = self.get_client()

        if not project_id:
            raise IntegrationError("project must be provided")

        if not issue_num:
            raise IntegrationError("issue must be provided")

        try:
            issue = client.get_issue(project_id, issue_num)
            project = client.get_project(project_id)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        project_and_issue_iid = "{}#{}".format(project["path_with_namespace"], issue["iid"])
        return {
            "key": project_and_issue_iid,
            "title": issue["title"],
            "description": issue["description"],
            "url": issue["web_url"],
            "project": project_id,
            "metadata": {"display_name": project_and_issue_iid},
        }

    def get_issue_display_name(self, external_issue):
        return external_issue.metadata["display_name"]
