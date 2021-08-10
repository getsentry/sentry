from django.conf.urls import url
from rest_framework.response import Response

from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.plugins.bases.issue2 import IssueGroupActionEndpoint, IssuePlugin2
from sentry.utils.http import absolute_uri
from sentry_plugins.base import CorePluginMixin

from .client import NotionApiClient

SETUP_URL = "https://github.com/getsentry/sentry/blob/master/src/sentry_plugins/notion/Notion_Instructions.md"  # NOQA
REFERRER = "notion_integration"
DESCRIPTION = """
Create pages in Notion directly from Sentry. This integration also allows
you to link Sentry issues to existing databases or pages in Notion.

Notion is the easy, free, flexible, and visual way to manage your projects
and organize anything, trusted by millions of people from all over the world.
"""


class NotionPlugin(CorePluginMixin, IssuePlugin2):
    description = DESCRIPTION
    slug = "notion"
    title = "Notion"
    conf_title = title
    conf_key = "notion"
    auth_provider = None
    resource_links = [("Notion Setup Instructions", SETUP_URL)] + CorePluginMixin.resource_links
    required_field = "key"
    feature_descriptions = [
        FeatureDescription(
            """
            Create and link Sentry issue groups directly to a Notion database in any of your
            workspaces, providing a quick way to jump from a Sentry bug to tracked ticket!
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
        FeatureDescription(
            """
            Link Sentry issues to existing Notion database
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
    ]

    def get_config(self, project, **kwargs):
        """
        Return the configuration of the plugin.
        Pull the value out of our the arguments to this function or from the DB
        """

        def get_value(field):
            initial_values = kwargs.get("initial", {})
            return initial_values.get(field) or self.get_option(field, project)

        api_key = get_value("key")

        key_config = {
            "name": "key",
            "type": "secret",
            "required": True,
            "label": "Notion Internal Integration Token",
            "default": api_key,
        }

        if api_key:
            # The token is sensitive so we should mask the value by only sending back the first 5 characters
            key_config["required"] = False
            key_config["prefix"] = api_key[:7]
            key_config["has_saved_value"] = True
        else:
            key_config["required"] = True

        config = [key_config]
        org_value = get_value("database")
        include_org = kwargs.get("add_additial_fields", org_value)
        if api_key and include_org:
            notion_client = NotionApiClient(api_key)
            try:
                org_databases = notion_client.get_databases_list()

                config.append(
                    {
                        "name": "database",
                        "label": "Default Notion Database",
                        "choices": org_databases,
                        "type": "select",
                        "required": False,
                        "default": org_value,
                        "has_autocomplete": True,
                    }
                )

            except Exception as e:
                self.raise_error(e)
        return config

    def validate_config(self, project, config, actor=None):
        """
        Make sure the configuration is valid by trying to query for databases with the auth
        """
        notion_client = NotionApiClient(config["key"])
        try:
            notion_client.get_databases(query=None)
        except Exception as e:
            self.raise_error(e)
        return config

    def get_group_urls(self):
        """
        Return the URLs and the matching views
        """
        return super().get_group_urls() + [
            url(
                r"^autocomplete",
                IssueGroupActionEndpoint.as_view(view_method_name="view_autocomplete", plugin=self),
            )
        ]

    def is_configured(self, request, project, **kwargs):
        return self.get_option("key", project)

    def get_new_issue_fields(self, request, group, event, **kwargs):
        """
        Return the fields needed for creating a new issue
        """
        fields = super().get_new_issue_fields(request, group, event, **kwargs)
        client = self.get_client(group.project)

        default_database = self.get_option("database", group.project)
        databases = client.get_databases_list()

        return fields + [
            {
                "name": "database",
                "label": "Database",
                "type": "select",
                "choices": databases,
                "readonly": False,
                "required": True,
                "default": default_database,
            }
        ]

    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        """
        Return the fields needed for linking to an existing issue
        """
        return [
            {
                "name": "issue_id",
                "label": "Notion page",
                "type": "select",
                "has_autocomplete": True,
                "required": True,
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": absolute_uri(group.get_absolute_url(params={"referrer": REFERRER})),
                "type": "textarea",
                "help": ("Leave blank if you don't want to " "add a comment to the Notion page."),
                "required": False,
            },
        ]

    def get_client(self, project):
        return NotionApiClient(self.get_option("key", project))

    def error_message_from_json(self, data):
        errors = data.get("errors")
        if errors:
            return " ".join(e["message"] for e in errors)
        return "unknown error"

    def create_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(group.project)

        try:
            issue_link = absolute_uri(group.get_absolute_url(params={"referrer": REFERRER}))
            data = {
                "parent": {"database_id": form_data["database"]},
                "properties": {"Name": {"title": [{"text": {"content": form_data["title"]}}]}},
                "children": [
                    {
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {
                            "text": [
                                {
                                    "type": "text",
                                    "text": {
                                        "content": group.qualified_short_id,
                                        "link": {"url": issue_link},
                                    },
                                }
                            ]
                        },
                    },
                    {"object": "block", "type": "paragraph", "paragraph": {"text": []}},
                    {
                        "object": "block",
                        "type": "paragraph",
                        "paragraph": {
                            "text": [
                                {"type": "text", "text": {"content": form_data["description"]}}
                            ]
                        },
                    },
                ],
            }
            notion_page = client.create_page(data=data)
        except Exception as e:
            self.raise_error(e)

        return notion_page["url"]

    def link_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(group.project)

        try:
            notion_page = client.get_page(form_data["issue_id"])
        except Exception as e:
            self.raise_error(e)

        comment = form_data.get("comment")
        if comment:
            try:
                client.append_block(
                    page_id=form_data["issue_id"],
                    comment=comment,
                    issue_id=group.qualified_short_id,
                    url=absolute_uri(group.get_absolute_url(params={"referrer": REFERRER})),
                )

            except Exception as e:
                self.raise_error(e)

        return {"id": notion_page["url"]}

    def get_issue_label(self, group, issue, **kwargs):
        """
        Return label of the linked issue we show in the UI from the issue string
        """
        return "Notion Page"

    def get_issue_url(self, group, issue, **kwargs):
        return issue

    def view_autocomplete(self, request, group, **kwargs):
        """
        Return the cards matching a given query and the organization of the configuration
        """
        field = request.GET.get("autocomplete_field")
        query = request.GET.get("autocomplete_query")

        def generate_page_title(page):
            if page["parent"]["type"] == "database_id":
                title = page["properties"]["Name"]["title"][0]["plain_text"]
            else:
                title = page["properties"]["title"]["title"][0]["plain_text"]

            return title

        output = []
        if field == "issue_id" and query:
            client = self.get_client(group.project)
            pages = client.get_pages(query)

            output = [
                {"text": generate_page_title(page), "id": page["id"]} for page in pages["results"]
            ]

        return Response({field: output})
