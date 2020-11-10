from __future__ import absolute_import
import six

from django.utils.translation import ugettext_lazy as _

from sentry.exceptions import PluginError
from sentry.plugins.bases.issue import IssuePlugin
from sentry_plugins.base import CorePluginMixin
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.integrations import FeatureDescription, IntegrationFeatures
import sentry

from .client import RedmineClient
from .forms import RedmineNewIssueForm

DESCRIPTION = """
Create issues in Redmine directly from Sentry. This integration also
allows you to link Sentry issues to existing tickets in Redmine.

Redmine is a flexible project management web application. Written using
the Ruby on Rails framework, it is cross-platform and cross-database.
"""


class RedminePlugin(CorePluginMixin, IssuePlugin):
    author = "Sentry"
    author_url = "https://github.com/getsentry/sentry"
    version = sentry.VERSION
    description = DESCRIPTION

    slug = "redmine"
    title = _("Redmine")
    conf_title = "Redmine"
    conf_key = "redmine"
    required_field = "host"
    feature_descriptions = [
        FeatureDescription(
            """
            Create and link Sentry issue groups directly to an Redmine issue in any of your
            projects, providing a quick way to jump from a Sentry bug to tracked ticket!
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
        FeatureDescription(
            """
            Link Sentry issues to existing Redmine issue.
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
    ]

    new_issue_form = RedmineNewIssueForm

    def __init__(self):
        super(RedminePlugin, self).__init__()
        self.client_errors = []
        self.fields = []

    def has_project_conf(self):
        return True

    def is_configured(self, project, **kwargs):
        return all((self.get_option(k, project) for k in ("host", "key", "project_id")))

    def get_new_issue_title(self, **kwargs):
        return "Create Redmine Task"

    def get_initial_form_data(self, request, group, event, **kwargs):
        return {
            "description": self._get_group_description(request, group, event),
            "title": self._get_group_title(request, group, event),
        }

    def _get_group_description(self, request, group, event):
        output = [absolute_uri(group.get_absolute_url())]
        body = self._get_group_body(request, group, event)
        if body:
            output.extend(["", "<pre>", body, "</pre>"])
        return "\n".join(output)

    def get_client(self, project):
        return RedmineClient(
            host=self.get_option("host", project), key=self.get_option("key", project)
        )

    def create_issue(self, group, form_data, **kwargs):
        """
        Create a Redmine issue
        """
        client = self.get_client(group.project)
        default_priority = self.get_option("default_priority", group.project)
        if default_priority is None:
            default_priority = 4

        issue_dict = {
            "project_id": self.get_option("project_id", group.project),
            "tracker_id": self.get_option("tracker_id", group.project),
            "priority_id": default_priority,
            "subject": form_data["title"].encode("utf-8"),
            "description": form_data["description"].encode("utf-8"),
        }

        extra_fields_str = self.get_option("extra_fields", group.project)
        if extra_fields_str:
            extra_fields = json.loads(extra_fields_str)
        else:
            extra_fields = {}
        issue_dict.update(extra_fields)

        response = client.create_issue(issue_dict)
        return response["issue"]["id"]

    def get_issue_url(self, group, issue_id, **kwargs):
        host = self.get_option("host", group.project)
        return u"{}/issues/{}".format(host.rstrip("/"), issue_id)

    def build_config(self):
        host = {
            "name": "host",
            "label": "Host",
            "type": "text",
            "help": "e.g. http://bugs.redmine.org",
            "required": True,
        }
        key = {
            "name": "key",
            "label": "Key",
            "type": "text",
            "help": "Your API key is available on your account page after enabling the Rest API (Administration -> Settings -> Authentication)",
            "required": True,
        }
        project_id = {
            "name": "project_id",
            "label": "Project*",
            "type": "select",
            "choices": [],
            "required": False,
        }
        tracker_id = {
            "name": "tracker_id",
            "label": "Tracker*",
            "type": "select",
            "choices": [],
            "required": False,
        }
        default_priority = {
            "name": "default_priority",
            "label": "Default Priority*",
            "type": "select",
            "choices": [],
            "required": False,
        }
        extra_fields = {
            "name": "extra_fields",
            "label": "Extra Fields",
            "type": "text",
            "help": "Extra attributes (custom fields, status id, etc.) in JSON format",
            "required": False,
        }
        return [host, key, project_id, tracker_id, default_priority, extra_fields]

    def add_choices(self, field_name, choices, default):
        for field in self.fields:
            if field_name == field["name"]:
                field["choices"] = choices
                field["default"] = default
                return

    def remove_field(self, field_name):
        for field in self.fields:
            if field["name"] == field_name:
                self.fields.remove(field)
                return

    def build_initial(self, initial_args, project):
        initial = {}
        fields = ["host", "key", "project_id", "tracker_id", "default_priority", "extra_fields"]
        for field in fields:
            value = initial_args.get(field) or self.get_option(field, project)
            if value is not None:
                initial[field] = value
        return initial

    def get_config(self, project, **kwargs):
        self.client_errors = []
        self.fields = self.build_config()
        initial_args = kwargs.get("initial") or {}
        initial = self.build_initial(initial_args, project)

        has_credentials = all(initial.get(k) for k in ("host", "key"))
        if has_credentials:
            client = RedmineClient(initial["host"], initial["key"])
            try:
                projects = client.get_projects()
            except Exception:
                has_credentials = False
                self.client_errors.append("There was an issue authenticating with Redmine")
            else:
                choices_value = self.get_option("project_id", project)
                project_choices = [("", "--")] if not choices_value else []
                project_choices += [
                    (p["id"], u"%s (%s)" % (p["name"], p["identifier"]))
                    for p in projects["projects"]
                ]
                self.add_choices("project_id", project_choices, choices_value)

        if has_credentials:
            try:
                trackers = client.get_trackers()
            except Exception:
                self.remove_field("tracker_id")
            else:
                choices_value = self.get_option("tracker_id", project)
                tracker_choices = [("", "--")] if not choices_value else []
                tracker_choices += [(p["id"], p["name"]) for p in trackers["trackers"]]
                self.add_choices("tracker_id", tracker_choices, choices_value)

            try:
                priorities = client.get_priorities()
            except Exception:
                self.remove_field("default_priority")
            else:
                choices_value = self.get_option("default_priority", project)
                tracker_choices = [("", "--")] if not choices_value else []
                tracker_choices += [(p["id"], p["name"]) for p in priorities["issue_priorities"]]
                self.add_choices("default_priority", tracker_choices, choices_value)

        if not has_credentials:
            for field_name in ["project_id", "tracker_id", "default_priority", "extra_fields"]:
                self.remove_field(field_name)

        return self.fields

    def validate_config(self, project, config, actor):
        super(RedminePlugin, self).validate_config(project, config, actor)
        self.client_errors = []

        for field in self.fields:
            if field["name"] in ["project_id", "tracker_id", "default_priority"]:
                if not config[field["name"]]:
                    self.logger.exception(six.text_type(u"{} required.".format(field["name"])))
                    self.client_errors.append(field["name"])

        if self.client_errors:
            raise PluginError(u", ".join(self.client_errors) + " required.")
        return config
