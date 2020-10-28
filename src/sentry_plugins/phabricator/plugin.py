from __future__ import absolute_import

from django.conf.urls import url
from rest_framework.response import Response

from sentry.exceptions import PluginError
from sentry.plugins.bases.issue2 import IssuePlugin2, IssueGroupActionEndpoint
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.integrations import FeatureDescription, IntegrationFeatures
from six.moves.urllib.parse import urljoin
from six.moves.http_client import HTTPException

from sentry_plugins.base import CorePluginMixin
from sentry_plugins.utils import get_secret_field_config

import phabricator

DESCRIPTION = """
Improve your productivity by creating tickets in Phabricator directly from Sentry issues.
This integration also allows you to link Sentry issues to existing tickets in Phabricator.

Phabricator is a set of tools for developing software. It includes applications for
code review, repository hosting, bug tracking, project management, and more.
"""


def query_to_result(field, result):
    if field == "issue_id":
        return u"T{}: {}".format(result["id"], result["fields"]["name"])

    if field == "assignee":
        return u"{} ({})".format(result["fields"]["realName"], result["fields"]["username"])

    return result["fields"]["name"]


class PhabricatorPlugin(CorePluginMixin, IssuePlugin2):
    description = DESCRIPTION

    slug = "phabricator"
    title = "Phabricator"
    conf_title = "Phabricator"
    conf_key = "phabricator"
    required_field = "host"
    feature_descriptions = [
        FeatureDescription(
            """
            Create and link Sentry issue groups directly to a Phabricator ticket in any of your
            projects, providing a quick way to jump from a Sentry bug to tracked ticket!
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
        FeatureDescription(
            """
            Link Sentry issues to existing Phabricator tickets.
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
    ]

    def get_api(self, project):
        return phabricator.Phabricator(
            host=urljoin(self.get_option("host", project), "api/"),
            username=self.get_option("username", project),
            certificate=self.get_option("certificate", project),
            token=self.get_option("token", project),
        )

    def get_configure_plugin_fields(self, request, project, **kwargs):
        token = self.get_option("token", project)
        helptext = "You may generate a Conduit API Token from your account settings in Phabricator."
        secret_field = get_secret_field_config(token, helptext, include_prefix=True)
        secret_field.update({"name": "token", "label": "Token", "required": False})

        return [
            {
                "name": "host",
                "label": "Host",
                "type": "text",
                "placeholder": "e.g. http://secure.phabricator.org",
                "required": True,
            },
            secret_field,
            {
                "name": "username",
                "label": "Username",
                "type": "text",
                "help": "For token-based authentication you do not need to fill in username.",
                "required": False,
            },
            {
                "name": "certificate",
                "label": "Certificate",
                "type": "textarea",
                "help": "For token-based authentication you do not need to fill in certificate.",
                "required": False,
            },
        ]

    def get_new_issue_fields(self, request, group, event, **kwargs):
        fields = super(PhabricatorPlugin, self).get_new_issue_fields(
            request, group, event, **kwargs
        )
        return fields + [
            {
                "name": "tags",
                "label": "Tags",
                "type": "select",
                "placeholder": "Start typing to search for a project",
                "multi": True,
                "required": False,
                "has_autocomplete": True,
            },
            {
                "name": "assignee",
                "label": "Assignee",
                "default": "",
                "type": "select",
                "placeholder": "Start typing to search for an assignee",
                "required": False,
                "has_autocomplete": True,
            },
        ]

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
                "default": u"Sentry issue: [{issue_id}]({url})".format(
                    url=absolute_uri(
                        group.get_absolute_url(params={"referrer": "phabricator_plugin"})
                    ),
                    issue_id=group.qualified_short_id,
                ),
                "type": "textarea",
                "help": ("Leave blank if you don't want to " "add a comment to the task."),
                "required": False,
            },
        ]

    def get_group_urls(self):
        return super(PhabricatorPlugin, self).get_group_urls() + [
            url(
                r"^autocomplete",
                IssueGroupActionEndpoint.as_view(view_method_name="view_autocomplete", plugin=self),
            )
        ]

    def validate_config(self, project, config, actor):
        projectPHIDs = config.get("projectPHIDs")
        if projectPHIDs:
            try:
                json.loads(projectPHIDs)
            except ValueError:
                raise PluginError("projectPHIDs field must be a valid JSON if present")
        if config.get("host") and (
            (config.get("username") and config.get("certificate")) or config.get("token")
        ):
            api = phabricator.Phabricator(
                host=urljoin(config["host"], "api/"),
                username=config.get("username"),
                certificate=config.get("certificate"),
                token=config.get("token"),
            )
            try:
                api.user.whoami()
            except phabricator.APIError as e:
                raise PluginError("%s %s" % (e.code, e))
            except HTTPException as e:
                raise PluginError("Unable to reach Phabricator host: %s" % (e,))
            except Exception as e:
                raise PluginError("Unhandled error from Phabricator: %s" % (e,))
        return config

    def is_configured(self, request, project, **kwargs):
        if not self.get_option("host", project):
            return False
        if self.get_option("token", project):
            return True
        if self.get_option("username", project) and self.get_option("certificate", project):
            return True
        return False

    def get_new_issue_title(self, **kwargs):
        return "Create Maniphest Task"

    def get_issue_label(self, group, issue_id, **kwargs):
        return "T%s" % issue_id

    def get_issue_url(self, group, issue_id, **kwargs):
        host = self.get_option("host", group.project)
        return urljoin(host, "T%s" % issue_id)

    def view_autocomplete(self, request, group, **kwargs):
        field = request.GET.get("autocomplete_field")
        query = request.GET.get("autocomplete_query")

        try:
            api = self.get_api(group.project)
            if field == "tags":
                response = api.project.search(constraints={"name": query})
            elif field == "issue_id":
                response = api.maniphest.search(constraints={"query": query})
            elif field == "assignee":
                response = api.user.search(constraints={"nameLike": query})

        except Exception as e:
            return self.handle_api_error(e)

        results = [
            {"text": query_to_result(field, i), "id": i["phid"]} for i in response.get("data", [])
        ]

        return Response({field: results})

    def create_issue(self, request, group, form_data, **kwargs):
        api = self.get_api(group.project)
        try:
            data = api.maniphest.createtask(
                title=form_data["title"].encode("utf-8"),
                description=form_data["description"].encode("utf-8"),
                ownerPHID=form_data.get("assignee"),
                projectPHIDs=form_data.get("tags"),
            )
        except phabricator.APIError as e:
            raise PluginError("%s %s" % (e.code, e))
        except HTTPException as e:
            raise PluginError("Unable to reach Phabricator host: %s" % e)

        return data["id"]

    def link_issue(self, request, group, form_data, **kwargs):
        api = self.get_api(group.project)

        try:
            results = api.maniphest.search(constraints={"phids": [form_data["issue_id"]]})
        except Exception as e:
            self.raise_error(e)

        task = results["data"][0]

        comment = form_data.get("comment")
        if comment:
            try:
                api.maniphest.edit(
                    objectIdentifier=form_data["issue_id"],
                    transactions=[{"type": "comment", "value": comment}],
                )
            except Exception as e:
                self.raise_error(e)

        return {
            "id": task["id"],
            "title": task["fields"]["name"],
            "url": self.get_issue_url(group, task["id"]),
        }
