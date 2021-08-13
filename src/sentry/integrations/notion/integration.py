from django.utils.translation import ugettext_lazy as _

from sentry import options
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.issues import IssueBasicMixin
from sentry.pipeline import PipelineView
from sentry.utils.http import absolute_uri

from .client import NOTION_API_URL, NotionApiClient

REFERRER = "notion_integration"
DESCRIPTION = """
Create pages in Notion directly from Sentry. This integration also allows
you to link Sentry issues to existing databases or pages in Notion.
Notion is the easy, free, flexible, and visual way to manage your projects
and organize anything, trusted by millions of people from all over the world.
"""

FEATURES = [
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

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Notion"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Notion%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/notion",
    aspects={},
)


def generate_page_title(page):
    if page["parent"]["type"] == "database_id":
        title = page["properties"]["Name"]["title"][0]["plain_text"]
    else:
        title = page["properties"]["title"]["title"][0]["plain_text"]

    return title


class NotionIntegration(IntegrationInstallation, IssueBasicMixin):
    def get_client(self):
        access_token = self.model.metadata["access_token"]
        return NotionApiClient(api_key=access_token)

    comment_key = "sync_comments"
    outbound_status_key = "sync_status_outbound"
    inbound_status_key = "sync_status_inbound"
    outbound_assignee_key = "sync_assignee_outbound"
    inbound_assignee_key = "sync_assignee_inbound"

    def get_issue_url(self, key):
        return f"https://www.notion.so/{key}"

    def get_issue_display_name(self, external_issue):
        return "{}#{}".format(self.model.metadata["workspace_name"], external_issue.title)

    def get_create_issue_config(self, group, user, **kwargs):
        kwargs["link_referrer"] = REFERRER
        fields = super().get_create_issue_config(group, user, **kwargs)
        notion_client = self.get_client()
        notion_pages = notion_client.get_databases_list()

        project_field = {
            "name": "notion_page",
            "label": "Notion page",
            "choices": notion_pages,
            "type": "select",
            "required": True,
        }

        return fields + [project_field]

    def get_link_issue_config(self, group, **kwargs):
        """
        Return the fields needed for linking to an existing issue
        """
        notion_client = self.get_client()
        notion_pages = notion_client.get_pages()
        output = [(page["id"], generate_page_title(page)) for page in notion_pages["results"]]

        # TODO: Add autocomplete on "externalIssue" key
        return [
            {
                "name": "externalIssue",
                "label": "Notion database",
                "type": "select",
                "required": True,
                "choices": output,
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

    def create_issue(self, data, **kwargs):
        notion_client = self.get_client()

        try:
            payload = {
                "parent": {"database_id": data["notion_page"]},
                "properties": {"Name": {"title": [{"text": {"content": data["title"]}}]}},
                "children": [
                    {
                        "object": "block",
                        "type": "heading_2",
                        "heading_2": {
                            "text": [
                                {
                                    "type": "text",
                                    "text": {
                                        "content": "Sentry integration",
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
                            "text": [{"type": "text", "text": {"content": data["description"]}}]
                        },
                    },
                ],
            }

            notion_page = notion_client.create_page(data=payload)
        except Exception as e:
            self.raise_error(e)

        key = notion_page["url"].split("-")

        return {
            "key": key[-1],
            "title": data["title"],
            "description": data["description"],
        }

    def after_link_issue(self, external_issue, **kwargs):
        data = kwargs["data"]
        notion_client = self.get_client()
        comment = data["comment"]

        if comment:
            try:
                notion_client.append_block(
                    page_id=external_issue.key,
                    comment=comment,
                )

            except Exception as e:
                self.raise_error(e)

    def get_issue(self, issue_id, **kwargs):
        notion_client = self.get_client()
        notion_page = notion_client.get_page(issue_id)

        key = notion_page["url"].split("-")

        return {
            "key": key[-1],
            "title": generate_page_title(notion_page),
            "description": "Workspace: %s" % self.model.metadata["workspace_name"],
        }


class NotionIntegrationProvider(IntegrationProvider):
    key = "notion"
    name = "Notion"
    metadata = metadata

    features = frozenset(
        [
            IntegrationFeatures.ISSUE_BASIC,
        ]
    )
    integration_cls = NotionIntegration

    setup_dialog_config = {"width": 600, "height": 900}

    def get_pipeline_views(self):
        return [NotionInstallationRedirect()]

    def build_integration(self, state):
        code = state["code"]
        setup_url = absolute_uri("/extensions/notion/setup/")
        authentication = NotionApiClient().authenticate(code=code, redirect_uri=setup_url)

        return {
            "external_id": authentication["workspace_name"],
            "name": "Workspace: %s" % authentication["workspace_name"],
            "metadata": {
                "access_token": authentication["access_token"],
                "workspace_icon": authentication["workspace_icon"],
                "workspace_name": authentication["workspace_name"],
            },
        }


class NotionInstallationRedirect(PipelineView):
    def get_app_url(self, account_name=None):
        if not account_name:
            account_name = "app"

        setup_url = absolute_uri("/extensions/notion/setup/")
        client_id = options.get("notion-app.client-id")

        return "{}/oauth/authorize?client_id={}&redirect_uri={}&response_type=code".format(
            NOTION_API_URL,
            client_id,
            setup_url,
        )

    def dispatch(self, request, pipeline):
        if "code" in request.GET:
            pipeline.bind_state("code", request.GET["code"])
            return pipeline.next_step()

        return self.redirect(self.get_app_url())
