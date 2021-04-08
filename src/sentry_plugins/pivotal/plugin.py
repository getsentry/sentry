from urllib.parse import urlencode

import requests
from django.conf.urls import url
from django.utils.encoding import force_text
from rest_framework.response import Response

from sentry.http import safe_urlopen, safe_urlread
from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.plugins.bases.issue2 import IssueGroupActionEndpoint, IssuePlugin2, PluginError
from sentry.utils import json
from sentry_plugins.base import CorePluginMixin
from sentry_plugins.utils import get_secret_field_config

DESCRIPTION = """
Improve your productivity by creating tickets in Pivotal Tracker directly from Sentry issues.
This integration also allows you to link Sentry issues to existing tickets in Pivotal Tracker.

Pivotal Tracker is a straightforward project-planning tool that helps software development
teams form realistic expectations about when work might be completed based on the teams
ongoing performance. Tracker visualizes your projects in the form of stories
moving through your workflow, encouraging you to break down projects into manageable
chunks and have important conversations about deliverables and scope.
"""


class PivotalPlugin(CorePluginMixin, IssuePlugin2):
    description = DESCRIPTION
    slug = "pivotal"
    title = "Pivotal Tracker"
    conf_title = title
    conf_key = "pivotal"
    required_field = "token"
    feature_descriptions = [
        FeatureDescription(
            """
            Create and link Sentry issue groups directly to a Pivotal Tracker ticket in any of your
            projects, providing a quick way to jump from a Sentry bug to tracked ticket!
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
        FeatureDescription(
            """
            Link Sentry issues to existing Pivotal Tracker tickets.
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
    ]

    def get_group_urls(self):
        return super().get_group_urls() + [
            url(
                r"^autocomplete",
                IssueGroupActionEndpoint.as_view(view_method_name="view_autocomplete", plugin=self),
            )
        ]

    def is_configured(self, request, project, **kwargs):
        return all(self.get_option(k, project) for k in ("token", "project"))

    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        return [
            {
                "name": "issue_id",
                "label": "Story",
                "default": "",
                "type": "select",
                "has_autocomplete": True,
                "help": "Search Pivotal Stories by name or description.",
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": group.get_absolute_url(params={"referrer": "pivotal_plugin"}),
                "type": "textarea",
                "help": ("Leave blank if you don't want to " "add a comment to the Pivotal story."),
                "required": False,
            },
        ]

    def handle_api_error(self, error):
        msg = "Error communicating with Pivotal Tracker"
        status = 400 if isinstance(error, PluginError) else 502
        return Response({"error_type": "validation", "errors": {"__all__": msg}}, status=status)

    def view_autocomplete(self, request, group, **kwargs):
        field = request.GET.get("autocomplete_field")
        query = request.GET.get("autocomplete_query")
        if field != "issue_id" or not query:
            return Response({"issue_id": []})
        query = query.encode("utf-8")
        _url = "{}?{}".format(self.build_api_url(group, "search"), urlencode({"query": query}))
        try:
            req = self.make_api_request(group.project, _url)
            body = safe_urlread(req)
        except (requests.RequestException, PluginError) as e:
            return self.handle_api_error(e)

        try:
            json_resp = json.loads(body)

        except ValueError as e:
            return self.handle_api_error(e)

        resp = json_resp.get("stories", {})
        stories = resp.get("stories", [])
        issues = [{"text": "(#{}) {}".format(i["id"], i["name"]), "id": i["id"]} for i in stories]

        return Response({field: issues})

    def link_issue(self, request, group, form_data, **kwargs):
        comment = form_data.get("comment")
        if not comment:
            return
        _url = "{}/{}/comments".format(self.build_api_url(group, "stories"), form_data["issue_id"])
        try:
            req = self.make_api_request(group.project, _url, json_data={"text": comment})
            body = safe_urlread(req)
        except requests.RequestException as e:
            msg = str(e)
            raise PluginError(f"Error communicating with Pivotal: {msg}")

        try:
            json_resp = json.loads(body)
        except ValueError as e:
            msg = str(e)
            raise PluginError(f"Error communicating with Pivotal: {msg}")

        if req.status_code > 399:
            raise PluginError(json_resp["error"])

    def build_api_url(self, group, pivotal_api=None):
        project = self.get_option("project", group.project)

        _url = f"https://www.pivotaltracker.com/services/v5/projects/{project}/{pivotal_api}"

        return _url

    def make_api_request(self, project, _url, json_data=None):
        req_headers = {
            "X-TrackerToken": str(self.get_option("token", project)),
            "Content-Type": "application/json",
        }
        return safe_urlopen(_url, json=json_data, headers=req_headers, allow_redirects=True)

    def create_issue(self, request, group, form_data, **kwargs):
        json_data = {
            "story_type": "bug",
            "name": force_text(form_data["title"], encoding="utf-8", errors="replace"),
            "description": force_text(form_data["description"], encoding="utf-8", errors="replace"),
            "labels": ["sentry"],
        }

        try:
            _url = self.build_api_url(group, "stories")
            req = self.make_api_request(group.project, _url, json_data=json_data)
            body = safe_urlread(req)
        except requests.RequestException as e:
            msg = str(e)
            raise PluginError(f"Error communicating with Pivotal: {msg}")

        try:
            json_resp = json.loads(body)
        except ValueError as e:
            msg = str(e)
            raise PluginError(f"Error communicating with Pivotal: {msg}")

        if req.status_code > 399:
            raise PluginError(json_resp["error"])

        return json_resp["id"]

    def get_issue_label(self, group, issue_id, **kwargs):
        return "#%s" % issue_id

    def get_issue_url(self, group, issue_id, **kwargs):
        return "https://www.pivotaltracker.com/story/show/%s" % issue_id

    def get_issue_title_by_id(self, request, group, issue_id):
        _url = "{}/{}".format(self.build_api_url(group, "stories"), issue_id)
        req = self.make_api_request(group.project, _url)

        body = safe_urlread(req)
        json_resp = json.loads(body)
        return json_resp["name"]

    def get_configure_plugin_fields(self, request, project, **kwargs):
        token = self.get_option("token", project)
        helptext = (
            "Enter your API Token (found on "
            '<a href="https://www.pivotaltracker.com/profile"'
            ">pivotaltracker.com/profile</a>)."
        )
        secret_field = get_secret_field_config(token, helptext, include_prefix=True)
        secret_field.update(
            {
                "name": "token",
                "label": "API Token",
                "placeholder": "e.g. a9877d72b6d13b23410a7109b35e88bc",
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
