from __future__ import absolute_import

import re
import six
from django.conf.urls import url
from rest_framework.response import Response
from requests.exceptions import RequestException
from django.utils.translation import ugettext_lazy as _


from sentry.exceptions import PluginError
from sentry.plugins.bases.issue2 import IssuePlugin2, IssueGroupActionEndpoint
from sentry_plugins.base import CorePluginMixin
from .client import TrelloApiClient

# TODO(Update URLs and usage)
SETUP_URL = "https://github.com/getsentry/sentry-trello/blob/master/HOW_TO_SETUP.md"  # NOQA

ISSUES_URL = "https://github.com/getsentry/sentry-trello/issues"


ERR_AUTH_NOT_CONFIGURED = "You still need to associate a Trello identity with this account."


class TrelloPlugin(CorePluginMixin, IssuePlugin2):
    description = "Create Trello cards on issues"
    slug = "trello"
    title = "Trello"
    conf_title = title
    conf_key = "trello"
    auth_provider = None

    def get_config(self, project, **kwargs):
        # function to pull the value out of our the arguments to this function or from the DB
        def get_value(field):
            initial_values = kwargs.get('initial') or {}
            if initial_values.get(field):
                return initial_values[field]
            return self.get_option(field, project)

        token_config = {
            'name': 'token',
            'type': 'secret',
            'label': _('Trello API Token'),
            'default': None
        }

        token_val = get_value('token')
        if token_val:
            token_config['required'] = False
            token_config['prefix'] = token_val[:5]
            token_config['has_saved_value'] = True
        else:
            token_config['required'] = True

        key_val = get_value('key')

        key_config = {
            'name': 'key',
            'type': 'text',
            'required': True,
            'label': _('Trello API Key'),
            'default': key_val,
        }

        config = [key_config, token_config]
        org_value = get_value('organization')
        include_org = kwargs.get('add_additial_fields') or org_value
        if key_val and token_val and include_org:
            trello_client = TrelloApiClient(key_val, token_val)
            try:
                org_options = trello_client.get_organization_options()
                config.append({
                    'name': 'organization',
                    'label': _('Trello Organization'),
                    'choices': org_options,
                    'type': 'select',
                    'required': False,
                    'default': org_value
                })
            except RequestException as e:
                msg = six.text_type(e)
                raise PluginError("Error communicating with Trello: %s" % (msg,))
        return config

    def get_group_urls(self):
        return super(TrelloPlugin, self).get_group_urls() + [
            url(
                r"^autocomplete",
                IssueGroupActionEndpoint.as_view(view_method_name="view_autocomplete", plugin=self),
            ),
            # url(
            #     r"^get_options",
            #     IssueGroupActionEndpoint.as_view(view_method_name="view_autocomplete", plugin=self),
            # )
        ]

    def is_configured(self, request, project, **kwargs):
        return all((self.get_option(key, project) for key in ("token", "key")))

    def has_workspace_access(self, workspace, choices):
        for c in choices:
            if workspace == c:
                return True
        return False

    def get_board_choices(self, boards):
        return [(board["id"], board["name"]) for board in boards]

    def get_new_issue_fields(self, request, group, event, **kwargs):
        fields = super(TrelloPlugin, self).get_new_issue_fields(request, group, event, **kwargs)
        client = self.get_client(group.project)
        organization = self.get_option('organization', group.project)

        boards = client.get_boards(organization)
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
        return TrelloApiClient(
            self.get_option("key", project), token=self.get_option("token", project)
        )

    def error_message_from_json(self, data):
        errors = data.get("errors")
        if errors:
            return " ".join([e["message"] for e in errors])
        return "unknown error"

    def create_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(group.project)

        try:
            response = client.new_card(
                idList=form_data["list"], name=form_data["title"], desc=form_data["description"]
            )
        except Exception as e:
            self.raise_error(e, identity=client.auth)

        return response["shortLink"]

    def get_issue_label(self, group, issue, **kwargs):
        # the old version of the plugin stores the url in the issue
        if re.search("\w+/https://trello.com/", issue):
            short_issue = issue.partition('/')[0]
            return "Trello-%s" % short_issue
        return "Trello-%s" % issue

    def get_issue_url(self, group, issue, **kwargs):
        # TODO(Steve): figure out why we sometimes get a string and sometimes a dict
        if isinstance(issue, dict):
            issue = issue["id"]
        # the old version of the plugin stores the url in the issue
        if re.search("\w+/https://trello.com/", issue):
            url = issue.partition('/')[2]
            return url
        return "https://trello.com/c/%s" % issue

    # def validate_config(self, project, config, actor):
    #     """
    #     ```
    #     if config['foo'] and not config['bar']:
    #         raise PluginError('You cannot configure foo with bar')
    #     return config
    #     ```
    #     """
    #     return config

    def view_autocomplete(self, request, group, **kwargs):
        # Note that we don't do a true autocomplete here since the API for search doesn't work for lists
        field = request.GET.get("autocomplete_field")
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
                results = [{"text": i["name"], "id": i["id"]} for i in response]

        return Response({field: results})
