from __future__ import absolute_import

import six

from django.conf.urls import url
from rest_framework.response import Response

from sentry.exceptions import PluginError, PluginIdentityRequired
from sentry.plugins.bases.issue2 import IssuePlugin2, IssueGroupActionEndpoint
from sentry.utils.http import absolute_uri
from sentry.integrations import FeatureDescription, IntegrationFeatures

from sentry_plugins.base import CorePluginMixin
from .client import AsanaClient


ERR_AUTH_NOT_CONFIGURED = "You still need to associate an Asana identity with this account."

DESCRIPTION = """
Improve your productivity by creating tasks in Asana directly
from Sentry issues. This integration also allows you to link Sentry
issues to existing tasks in Asana.
"""


class AsanaPlugin(CorePluginMixin, IssuePlugin2):
    description = DESCRIPTION
    slug = "asana"
    title = "Asana"
    conf_title = title
    conf_key = "asana"
    auth_provider = "asana"
    required_field = "workspace"
    feature_descriptions = [
        FeatureDescription(
            """
            Create and link Sentry issue groups directly to an Asana ticket in any of your
            projects, providing a quick way to jump from a Sentry bug to tracked ticket!
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
        FeatureDescription(
            """
            Link Sentry issues to existing Asana tickets.
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
    ]

    def get_group_urls(self):
        return super(AsanaPlugin, self).get_group_urls() + [
            url(
                r"^autocomplete",
                IssueGroupActionEndpoint.as_view(view_method_name="view_autocomplete", plugin=self),
            )
        ]

    def is_configured(self, request, project, **kwargs):
        return bool(self.get_option("workspace", project))

    def has_workspace_access(self, workspace, choices):
        for c, _ in choices:
            if workspace == c:
                return True
        return False

    def get_workspace_choices(self, workspaces):
        return [(w["gid"], w["name"]) for w in workspaces["data"]]

    def get_new_issue_fields(self, request, group, event, **kwargs):
        fields = super(AsanaPlugin, self).get_new_issue_fields(request, group, event, **kwargs)
        client = self.get_client(request.user)
        workspaces = client.get_workspaces()
        workspace_choices = self.get_workspace_choices(workspaces)
        workspace = self.get_option("workspace", group.project)
        if workspace and not self.has_workspace_access(workspace, workspace_choices):
            workspace_choices.append((workspace, workspace))

        # use labels that are more applicable to asana
        for field in fields:
            if field["name"] == "title":
                field["label"] = "Name"
            if field["name"] == "description":
                field["label"] = "Notes"
                field["required"] = False

        return (
            [
                {
                    "name": "workspace",
                    "label": "Asana Workspace",
                    "default": workspace,
                    "type": "select",
                    "choices": workspace_choices,
                    "readonly": True,
                }
            ]
            + fields
            + [
                {
                    "name": "project",
                    "label": "Project",
                    "type": "select",
                    "has_autocomplete": True,
                    "required": False,
                    "placeholder": "Start typing to search for a project",
                },
                {
                    "name": "assignee",
                    "label": "Assignee",
                    "type": "select",
                    "has_autocomplete": True,
                    "required": False,
                    "placeholder": "Start typing to search for a user",
                },
            ]
        )

    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        return [
            {
                "name": "issue_id",
                "label": "Task",
                "default": "",
                "type": "select",
                "has_autocomplete": True,
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": absolute_uri(
                    group.get_absolute_url(params={"referrer": "asana_plugin"})
                ),
                "type": "textarea",
                "help": ("Leave blank if you don't want to " "add a comment to the Asana issue."),
                "required": False,
            },
        ]

    def get_client(self, user):
        auth = self.get_auth_for_user(user=user)
        if auth is None:
            raise PluginIdentityRequired(ERR_AUTH_NOT_CONFIGURED)
        return AsanaClient(auth=auth)

    def error_message_from_json(self, data):
        errors = data.get("errors")
        if errors:
            return " ".join([e["message"] for e in errors])
        return "unknown error"

    def create_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(request.user)

        try:
            response = client.create_issue(
                workspace=self.get_option("workspace", group.project), data=form_data
            )
        except Exception as e:
            self.raise_error(e, identity=client.auth)

        return response["data"]["gid"]

    def link_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(request.user)
        try:
            issue = client.get_issue(issue_id=form_data["issue_id"])["data"]
        except Exception as e:
            self.raise_error(e, identity=client.auth)

        comment = form_data.get("comment")
        if comment:
            try:
                client.create_comment(issue["gid"], {"text": comment})
            except Exception as e:
                self.raise_error(e, identity=client.auth)

        return {"title": issue["name"]}

    def get_issue_label(self, group, issue_id, **kwargs):
        return "Asana Issue"

    def get_issue_url(self, group, issue_id, **kwargs):
        return "https://app.asana.com/0/0/%s" % issue_id

    def validate_config(self, project, config, actor):
        """
        ```
        if config['foo'] and not config['bar']:
            raise PluginError('You cannot configure foo with bar')
        return config
        ```
        """
        try:
            int(config["workspace"])
        except ValueError as exc:
            self.logger.exception(six.text_type(exc))
            raise PluginError("Non-numeric workspace value")
        return config

    def get_config(self, *args, **kwargs):
        user = kwargs["user"]
        try:
            client = self.get_client(user)
        except PluginIdentityRequired as e:
            self.raise_error(e)
        workspaces = client.get_workspaces()
        workspace_choices = self.get_workspace_choices(workspaces)
        workspace = self.get_option("workspace", kwargs["project"])
        # check to make sure the current user has access to the workspace
        helptext = None
        if workspace and not self.has_workspace_access(workspace, workspace_choices):
            workspace_choices.append((workspace, workspace))
            helptext = (
                "This plugin has been configured for an Asana workspace "
                "that either you don't have access to or doesn't "
                "exist. You can edit the configuration, but you will not "
                "be able to change it back to the current configuration "
                "unless a teammate grants you access to the workspace in Asana."
            )
        return [
            {
                "name": "workspace",
                "label": "Workspace",
                "type": "select",
                "choices": workspace_choices,
                "default": workspace or workspaces["data"][0]["gid"],
                "help": helptext,
            }
        ]

    def view_autocomplete(self, request, group, **kwargs):
        field = request.GET.get("autocomplete_field")
        query = request.GET.get("autocomplete_query")

        client = self.get_client(request.user)
        workspace = self.get_option("workspace", group.project)
        results = []
        field_name = field
        if field == "issue_id":
            field_name = "task"
        elif field == "assignee":
            field_name = "user"
        try:
            response = client.search(workspace, field_name, query.encode("utf-8"))
        except Exception as e:
            return Response(
                {"error_type": "validation", "errors": [{"__all__": self.message_from_error(e)}]},
                status=400,
            )
        else:
            results = [
                {"text": "(#%s) %s" % (i["gid"], i["name"]), "id": i["gid"]}
                for i in response.get("data", [])
            ]

        return Response({field: results})
