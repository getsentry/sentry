from __future__ import absolute_import

import re
from django.conf.urls import url
from rest_framework.response import Response


from sentry.utils.http import absolute_uri
from sentry.plugins.bases.issue2 import IssuePlugin2, IssueGroupActionEndpoint
from sentry_plugins.base import CorePluginMixin
from sentry.integrations import FeatureDescription, IntegrationFeatures
from .client import TrelloApiClient


SETUP_URL = "https://github.com/getsentry/sentry/blob/master/src/sentry_plugins/trello/Trello_Instructions.md"  # NOQA

LABLEX_REGEX = re.compile(r"\w+/https://trello\.com/")

DESCRIPTION = """
Create cards in Trello directly from Sentry. This integration also allows
you to link Sentry issues to existing cards in Trello.

Trello is the easy, free, flexible, and visual way to manage your projects
and organize anything, trusted by millions of people from all over the world.
"""


class TrelloPlugin(CorePluginMixin, IssuePlugin2):
    description = DESCRIPTION
    slug = "trello"
    title = "Trello"
    conf_title = title
    conf_key = "trello"
    auth_provider = None
    resource_links = [("Trello Setup Instructions", SETUP_URL)] + CorePluginMixin.resource_links
    required_field = "key"
    feature_descriptions = [
        FeatureDescription(
            """
            Create and link Sentry issue groups directly to an Trello card in any of your
            projects, providing a quick way to jump from a Sentry bug to tracked ticket!
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
        FeatureDescription(
            """
            Link Sentry issues to existing Trello cards
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

        token_config = {
            "name": "token",
            "type": "secret",
            "label": "Trello API Token",
            "default": None,
        }

        token_val = get_value("token")
        if token_val:
            # The token is sensitive so we should mask the value by only sending back the first 5 characters
            token_config["required"] = False
            token_config["prefix"] = token_val[:5]
            token_config["has_saved_value"] = True
        else:
            token_config["required"] = True

        api_key = get_value("key")

        key_config = {
            "name": "key",
            "type": "text",
            "required": True,
            "label": "Trello API Key",
            "default": api_key,
        }

        config = [key_config, token_config]
        org_value = get_value("organization")
        include_org = kwargs.get("add_additial_fields", org_value)
        if api_key and token_val and include_org:
            trello_client = TrelloApiClient(api_key, token_val)
            try:
                org_options = trello_client.get_organization_options()
                config.append(
                    {
                        "name": "organization",
                        "label": "Trello Organization",
                        "choices": org_options,
                        "type": "select",
                        "required": False,
                        "default": org_value,
                    }
                )
            except Exception as e:
                self.raise_error(e)
        return config

    def validate_config(self, project, config, actor=None):
        """
        Make sure the configuration is valid by trying to query for the organizations with the auth
        """
        trello_client = TrelloApiClient(config["key"], config["token"])
        try:
            trello_client.get_organization_options()
        except Exception as e:
            self.raise_error(e)
        return config

    def get_group_urls(self):
        """
        Return the URLs and the matching views
        """
        return super(TrelloPlugin, self).get_group_urls() + [
            url(
                r"^options",
                IssueGroupActionEndpoint.as_view(view_method_name="view_options", plugin=self),
            ),
            url(
                r"^autocomplete",
                IssueGroupActionEndpoint.as_view(view_method_name="view_autocomplete", plugin=self),
            ),
        ]

    def is_configured(self, request, project, **kwargs):
        return all(self.get_option(key, project) for key in ("token", "key"))

    # used for boards and lists but not cards (shortLink used as ID for cards)
    def map_to_options(self, items):
        return [(item["id"], item["name"]) for item in items]

    def get_new_issue_fields(self, request, group, event, **kwargs):
        """
        Return the fields needed for creating a new issue
        """
        fields = super(TrelloPlugin, self).get_new_issue_fields(request, group, event, **kwargs)
        client = self.get_client(group.project)
        organization = self.get_option("organization", group.project)

        boards = client.get_boards(organization)
        board_choices = self.map_to_options(boards)

        return fields + [
            {
                "name": "board",
                "label": "Board",
                "type": "select",
                "choices": board_choices,
                "readonly": False,
                "required": True,
            },
            {
                "name": "list",
                "depends": ["board"],
                "label": "List",
                "type": "select",
                "has_autocomplete": False,
                "required": True,
            },
        ]

    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        """
        Return the fields needed for linking to an existing issue
        """
        return [
            {
                "name": "issue_id",
                "label": "Card",
                "type": "select",
                "has_autocomplete": True,
                "required": True,
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": absolute_uri(
                    group.get_absolute_url(params={"referrer": "trello_plugin"})
                ),
                "type": "textarea",
                "help": ("Leave blank if you don't want to " "add a comment to the Trello card."),
                "required": False,
            },
        ]

    def get_client(self, project):
        return TrelloApiClient(
            self.get_option("key", project), token=self.get_option("token", project)
        )

    def error_message_from_json(self, data):
        errors = data.get("errors")
        if errors:
            return " ".join(e["message"] for e in errors)
        return "unknown error"

    def create_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(group.project)

        try:
            response = client.new_card(
                id_list=form_data["list"], name=form_data["title"], desc=form_data["description"]
            )
        except Exception as e:
            self.raise_error(e)

        return response["shortLink"]

    def link_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(group.project)

        try:
            card = client.get_card(form_data["issue_id"])
        except Exception as e:
            self.raise_error(e)

        comment = form_data.get("comment")
        if comment:
            try:
                client.create_comment(card["shortLink"], comment)
            except Exception as e:
                self.raise_error(e)

        return {"title": card["name"], "id": card["shortLink"]}

    def get_issue_label(self, group, issue, **kwargs):
        """
        Return label of the linked issue we show in the UI from the issue string
        """
        # the old version of the plugin stores the url in the issue
        if LABLEX_REGEX.search(issue):
            short_issue = issue.split("/", 1)[0]
            return "Trello-%s" % short_issue
        return "Trello-%s" % issue

    def get_issue_url(self, group, issue, **kwargs):
        """
        Return label of the url of card in Trello based off the issue object or issue ID
        """
        # TODO(Steve): figure out why we sometimes get a string and sometimes a dict
        if isinstance(issue, dict):
            issue = issue["id"]
        # the old version of the plugin stores the url in the issue
        if LABLEX_REGEX.search(issue):
            return issue.split("/", 1)[1]
        return "https://trello.com/c/%s" % issue

    def view_options(self, request, group, **kwargs):
        """
        Return the lists on a given Trello board
        """
        field = request.GET.get("option_field")
        board = request.GET.get("board")

        results = []
        if field == "list" and board:
            client = self.get_client(group.project)
            try:
                response = client.get_lists_of_board(board)
            except Exception as e:
                return Response(
                    {
                        "error_type": "validation",
                        "errors": [{"__all__": self.message_from_error(e)}],
                    },
                    status=400,
                )
            else:
                results = self.map_to_options(response)

        return Response({field: results})

    def view_autocomplete(self, request, group, **kwargs):
        """
        Return the cards matching a given query and the organization of the configuration
        """
        field = request.GET.get("autocomplete_field")
        query = request.GET.get("autocomplete_query")

        output = []
        if field == "issue_id" and query:
            organization = self.get_option("organization", group.project)

            client = self.get_client(group.project)
            cards = client.get_cards(query, organization)
            output = [
                {"text": "(#%s) %s" % (card["idShort"], card["name"]), "id": card["shortLink"]}
                for card in cards
            ]

        return Response({field: output})
