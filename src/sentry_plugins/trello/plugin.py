#!/usr/bin/env python
from __future__ import absolute_import

import sentry
import six

from django import forms
from django.utils.translation import ugettext_lazy as _
from requests.exceptions import RequestException
from sentry.plugins.base import JSONResponse
from sentry.plugins.bases.issue import IssuePlugin, NewIssueForm
from sentry.exceptions import PluginError
from sentry.utils.http import absolute_uri

from .client import TrelloClient

SETUP_URL = (
    "https://github.com/getsentry/sentry/blob/master/src/sentry_plugins/trello/HOW_TO_SETUP.md"
)  # NOQA

ISSUES_URL = "https://github.com/getsentry/sentry/issues"

EMPTY = (("", "--"),)


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


class TrelloUnauthorized(TrelloError):
    status_code = 401


class TrelloForm(NewIssueForm):
    title = forms.CharField(
        label=_("Title"), max_length=200, widget=forms.TextInput(attrs={"class": "span9"})
    )
    description = forms.CharField(
        label=_("Description"), widget=forms.Textarea(attrs={"class": "span9"})
    )
    trello_board = forms.CharField(label=_("Board"), max_length=50)
    trello_list = forms.CharField(label=_("List"), max_length=50)

    def __init__(self, data=None, initial=None):
        super(TrelloForm, self).__init__(data=data, initial=initial)
        self.fields["trello_board"].widget = forms.Select(choices=EMPTY + initial.get("boards", ()))
        self.fields["trello_list"].widget = forms.Select(
            attrs={"disabled": True}, choices=initial.get("list", ())
        )


class TrelloPlugin(IssuePlugin):
    author = "Damian Zaremba"
    author_url = "https://sentry.io"
    title = _("Trello")
    description = _("Create Trello cards on exceptions.")
    slug = "trello"

    resource_links = [
        (_("How do I configure this?"), SETUP_URL),
        (_("Bug Tracker"), ISSUES_URL),
        (_("Source"), "https://github.com/getsentry/sentry"),
    ]

    error_messages = {
        "invalid_auth": _("Invalid credentials. Please check your key and token and try again."),
        "api_failure": _("An unknown error occurred while fetching data from Trello."),
    }

    conf_title = title
    conf_key = "trello"

    version = sentry.VERSION
    new_issue_form = TrelloForm
    create_issue_template = "sentry/plugins/trello/create_trello_issue.html"
    plugin_misconfigured_template = "sentry/plugins/trello/plugin_misconfigured.html"

    def __init__(self):
        super(TrelloPlugin, self).__init__()
        self.client_errors = []
        self.additial_fields = []

    def _get_group_description(self, request, group, event):
        """
        Return group description in markdown-compatible format.

        This overrides an internal method to IssuePlugin.
        """
        output = [absolute_uri(group.get_absolute_url())]
        body = self._get_group_body(request, group, event)
        if body:
            output.extend(["", "\n".join("    " + line for line in body.splitlines())])
        return "\n".join(output)

    def is_configured(self, request, project, **kwargs):
        return all((self.get_option(key, project) for key in ("key", "token")))

    def has_project_conf(self):
        return True

    def get_client(self, project):
        return TrelloClient(
            apikey=self.get_option("key", project), token=self.get_option("token", project)
        )

    def view(self, request, group, **kwargs):
        if request.is_ajax():
            view = self.view_ajax
        else:
            view = super(TrelloPlugin, self).view
        try:
            return view(request, group, **kwargs)
        except TrelloError as e:
            if request.is_ajax():
                return JSONResponse({})
            return self.render(
                self.plugin_misconfigured_template,
                {"text": e.text, "title": self.get_new_issue_title()},
            )

    def view_ajax(self, request, group, **kwargs):
        if request.GET.get("action", "") != "lists":
            return JSONResponse({})
        board_id = request.GET["board_id"]
        trello = self.get_client(group.project)
        lists = trello.get_board_list(board_id, fields="name")
        return JSONResponse({"result": lists})

    def get_initial_form_data(self, request, group, event, **kwargs):
        # TODO(dcramer): token is a secret and should be treated like a password
        # i.e. not returned into responses
        initial = super(TrelloPlugin, self).get_initial_form_data(request, group, event, **kwargs)
        trello = self.get_client(group.project)
        organization = self.get_option("organization", group.project)
        options = {}
        if organization:
            options["organization"] = organization
        try:
            boards = trello.boards_to_options(**options)
        except RequestException as e:
            resp = e.response
            if not resp:
                raise TrelloError("Internal Error")
            if resp.status_code == 401:
                raise TrelloUnauthorized.from_response(resp)
            raise TrelloError.from_response(resp)

        initial.update({"boards": boards})
        return initial

    def get_issue_label(self, group, issue_id, **kwargs):
        iid, iurl = issue_id.split("/", 1)
        return _("Trello-%s") % iid

    def get_issue_url(self, group, issue_id, **kwargs):
        iid, iurl = issue_id.split("/", 1)
        return iurl

    def get_new_issue_title(self, **kwargs):
        return _("Create Trello Card")

    def create_issue(self, request, group, form_data, **kwargs):
        trello = self.get_client(group.project)
        try:
            card = trello.new_card(
                name=form_data["title"],
                desc=form_data["description"],
                idList=form_data["trello_list"],
            )
        except RequestException as e:
            raise forms.ValidationError(_("Error adding Trello card: %s") % six.text_type(e))

        return "%s/%s" % (card["id"], card["url"])

    def get_config(self, project, **kwargs):
        def get_from_initial(initial, field):
            return initial.get(field) or self.get_option(field, project)

        initial = kwargs.get("initial") or {}
        key_value = get_from_initial(initial, "key")

        key = {
            "name": "key",
            "label": _("Trello API Key"),
            "type": "text",
            "required": True,
            "default": key_value,
        }
        token = {
            "name": "token",
            "label": _("Trello API Token"),
            "type": "secret",
            "required": True,
        }
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
                            "label": _("Trello Organization"),
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

    def validate_config(self, project, config, actor):
        super(TrelloPlugin, self).validate_config(project, config, actor)
        errors = self.client_errors
        if errors:
            self.reset_options(project=project)
            self.client_errors = []
            raise PluginError(errors[0])

        return config
