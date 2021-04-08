from django.conf.urls import url
from rest_framework.response import Response

from sentry.exceptions import PluginError
from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.plugins.bases.issue2 import IssueGroupActionEndpoint, IssuePlugin2
from sentry.utils.http import absolute_uri
from sentry_plugins.base import CorePluginMixin
from sentry_plugins.utils import get_secret_field_config

from .client import ClubhouseClient


class ClubhousePlugin(CorePluginMixin, IssuePlugin2):
    description = "Create Clubhouse Stories from a project."
    slug = "clubhouse"
    title = "Clubhouse"
    conf_title = title
    conf_key = "clubhouse"
    required_field = "token"
    feature_descriptions = [
        FeatureDescription(
            """
            Create and link Sentry issue groups directly to a Clubhouse story in any of your
            projects, providing a quick way to jump from a Sentry bug to tracked ticket!
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
        FeatureDescription(
            """
            Link Sentry issues to existing Clubhouse stories.
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
    ]

    issue_fields = frozenset(["id", "title", "url"])

    def get_group_urls(self):
        return super().get_group_urls() + [
            url(
                r"^autocomplete",
                IssueGroupActionEndpoint.as_view(view_method_name="view_autocomplete", plugin=self),
            )
        ]

    def get_configure_plugin_fields(self, request, project, **kwargs):
        token = self.get_option("token", project)
        helptext = "Enter your API Token (found on " "your account Settings, under API Tokens)."
        secret_field = get_secret_field_config(token, helptext, include_prefix=True)
        secret_field.update(
            {
                "name": "token",
                "label": "API Token",
                "placeholder": "e.g. 12345678-1234-1234-1234-1234567890AB",
            }
        )
        return [
            secret_field,
            {
                "name": "project",
                "label": "Project ID",
                "default": self.get_option("project", project),
                "type": "text",
                "placeholder": "e.g. 639281",
                "help": "Enter your project's numerical ID.",
            },
        ]

    def is_configured(self, request, project, **kwargs):
        return all(self.get_option(k, project) for k in ("token", "project"))

    def get_client(self, project):
        token = self.get_option("token", project)
        return ClubhouseClient(token)

    def create_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(group.project)

        try:
            response = client.create_story(
                project=self.get_option("project", group.project), data=form_data
            )
        except Exception as e:
            self.raise_error(e)

        return {"id": response["id"], "title": response["name"], "url": response["app_url"]}

    def get_issue_label(self, group, issue, **kwargs):
        return "Clubhouse Story #%s" % issue["id"]

    def get_issue_url(self, group, issue, **kwargs):
        return issue["url"]

    def validate_config(self, project, config, actor):
        try:
            config["project"] = int(config["project"])
        except ValueError as exc:
            self.logger.exception(str(exc))
            raise PluginError(
                "Invalid Project ID. "
                "Project IDs are numbers-only, and can be found on the Project's page"
            )
        return config

    # This drives the `Link` UI
    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        return [
            {
                "name": "issue_id",
                "label": "Story",
                "default": "",
                "type": "select",
                "has_autocomplete": True,
                "help": (
                    "You can use any syntax supported by Clubhouse's "
                    '<a href="https://help.clubhouse.io/hc/en-us/articles/360000046646-Search-Operators" '
                    'target="_blank">search operators.</a>'
                ),
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": absolute_uri(
                    group.get_absolute_url(params={"referrer": "clubhouse_plugin"})
                ),
                "type": "textarea",
                "help": (
                    "Leave blank if you don't want to " "add a comment to the Clubhouse story."
                ),
                "required": False,
            },
        ]

    # Handle the incoming search terms, make requests and build responses
    def view_autocomplete(self, request, group, **kwargs):
        field = request.GET.get("autocomplete_field")
        query = request.GET.get("autocomplete_query")
        if field != "issue_id" or not query:
            return Response({"issue_id": []})

        project = self.get_option("project", group.project)

        client = self.get_client(group.project)

        # TODO: Something about the search API won't allow an explicit number search.
        # Should it switch the search mechanism from search_stories(text) to get_story(id)?
        try:
            response = client.search_stories(query=(f"project:{project} {query}").encode("utf-8"))
        except Exception as e:
            return self.handle_api_error(e)

        issues = [
            {"text": "(#{}) {}".format(i["id"], i["name"]), "id": i["id"]}
            for i in response.get("data", [])
        ]

        return Response({field: issues})

    def link_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(group.project)

        try:
            story = client.get_story(story_id=form_data["issue_id"])
        except Exception as e:
            self.raise_error(e)

        comment = form_data.get("comment")
        if comment:
            try:
                client.add_comment(story_id=story["id"], comment=comment)
            except Exception as e:
                self.raise_error(e)

        return {"id": story["id"], "title": story["name"], "url": story["app_url"]}
