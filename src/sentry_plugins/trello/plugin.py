from __future__ import absolute_import

import re
from django.conf.urls import url
from rest_framework.response import Response
from requests.exceptions import RequestException


from sentry.plugins.bases.issue2 import IssuePlugin2, IssueGroupActionEndpoint
from sentry_plugins.base import CorePluginMixin
from .client import TrelloClient

SETUP_URL = "https://github.com/getsentry/sentry-trello/blob/master/HOW_TO_SETUP.md"  # NOQA

ISSUES_URL = "https://github.com/getsentry/sentry-trello/issues"

EMPTY = (("", "--"),)

ERR_AUTH_NOT_CONFIGURED = "You still need to associate a Trello identity with this account."


class TrelloError(Exception):
    status_code = None

    def __init__(self, response_text, status_code=None):
        if status_code is not None:
            self.status_code = status_code
        self.text = response_text
        super(TrelloError, self).__init__(response_text[:128])

    @classmethod
    def from_response(cls, response):
        return cls(response.text, response.status_code)


class TrelloPlugin(CorePluginMixin, IssuePlugin2):
    description = "Create Trello cards on issues"
    slug = "trello"
    title = "Trello"
    conf_title = title
    conf_key = "trello"
    auth_provider = None
    allowed_actions = ("create",)

    def get_config(self, project, **kwargs):
        def get_from_initial(initial, field):
            return initial.get(field) or self.get_option(field, project)

        initial = kwargs.get("initial") or {}
        key_value = get_from_initial(initial, "key")

        key = {
            "name": "key",
            "label": "Trello API Key",
            "type": "text",
            "required": True,
            "default": key_value,
        }
        token = {"name": "token", "label": "Trello API Token", "type": "secret", "required": True}
        token_value = get_from_initial(initial, "token")

        if token_value:
            token["has_saved_value"] = True
            token["prefix"] = token_value[:6]
            token["required"] = False

        config = [key, token]

        if key_value and token_value:
            trello = TrelloClient(key_value, token_value)
            organizations = tuple()
            try:
                organizations = trello.organizations_to_options()
                organization_value = self.get_option("organization", project)
                if not organization_value:
                    organizations = EMPTY + organizations
                if get_from_initial(initial, "organization") or kwargs.get("add_additial_fields"):
                    config.append(
                        {
                            "name": "organization",
                            "label": "Trello Organization",
                            "type": "select",
                            "choices": organizations,
                            "default": organization_value,
                            "required": True,
                        }
                    )
            except RequestException as exc:
                if exc.response is not None and exc.response.status_code == 401:
                    self.client_errors.append(self.error_messages["invalid_auth"])
                else:
                    self.client_errors.append(self.error_messages["api_failure"])
        return config

    def get_group_urls(self):
        return super(TrelloPlugin, self).get_group_urls() + [
            url(
                r"^autocomplete",
                IssueGroupActionEndpoint.as_view(view_method_name="view_autocomplete", plugin=self),
            )
        ]

    def is_configured(self, request, project, **kwargs):
        return all((self.get_option(key, project) for key in ("key", "token", "organization")))

    def has_workspace_access(self, workspace, choices):
        for c, _ in choices:
            if workspace == c:
                return True
        return False

    def get_board_choices(self, boards):
        return [(board["id"], board["name"]) for board in boards]

    def get_new_issue_fields(self, request, group, event, **kwargs):
        fields = super(TrelloPlugin, self).get_new_issue_fields(request, group, event, **kwargs)
        client = self.get_client(request.user)
        boards = client.get_boards()
        board_choices = self.get_board_choices(boards)

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
                "has_autocomplete": True,
                "required": True,
                "placeholder": "Start typing to search for a List",
            },
        ]

    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        return []

    def get_client(self, project):
        return TrelloClient(
            apikey=self.get_option("key", project), token=self.get_option("token", project)
        )

    def error_message_from_json(self, data):
        errors = data.get("errors")
        if errors:
            return " ".join([e["message"] for e in errors])
        return "unknown error"

    def create_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(request.user)

        try:
            response = client.new_card(
                idList=form_data["list"], name=form_data["title"], desc=form_data["description"]
            )
        except Exception as e:
            self.raise_error(e, identity=client.auth)

        return response["shortLink"]

    def get_issue_label(self, group, issue_id, **kwargs):
        # the old version of the plugin stores the url in the issue_id
        if re.search("\w+/https://trello.com/", issue_id):
            short_issue_id, url = issue_id.split("/", 1)
            return "Trello-%s" % short_issue_id
        return "Trello-%s" % issue_id

    def get_issue_url(self, group, issue_id, **kwargs):
        # TODO(Steve): figure out why we sometimes get a string and sometimes a dict
        if isinstance(issue_id, dict):
            issue_id = issue_id["id"]
        # the old version of the plugin stores the url in the issue_id
        if re.search("\w+/https://trello.com/", issue_id):
            short_issue_id, url = issue_id.split("/", 1)
            return url
        return "https://trello.com/c/%s" % issue_id

    def validate_config(self, project, config, actor):
        """
        ```
        if config['foo'] and not config['bar']:
            raise PluginError('You cannot configure foo with bar')
        return config
        ```
        """
        return config

    def view_autocomplete(self, request, group, **kwargs):
        field = request.GET.get("autocomplete_field")
        # query = request.GET.get('autocomplete_query')
        board = request.GET.get("board")

        client = self.get_client(group.project)
        # organization = self.get_option('organization', group.project)
        results = []

        if field == "list" and board:

            try:
                response = client.get_board_list(board)
            except Exception as e:
                return Response(
                    {
                        "error_type": "validation",
                        "errors": [{"__all__": self.message_from_error(e)}],
                    },
                    status=400,
                )
            else:
                results = [{"text": i["name"], "id": i["id"]} for i in response]

        return Response({field: results})
