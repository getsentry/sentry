from __future__ import absolute_import

import responses

from exam import fixture
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory
from sentry.exceptions import PluginError
from sentry.models import GroupMeta
from sentry.testutils import PluginTestCase
from sentry.utils import json
from social_auth.models import UserSocialAuth

from sentry_plugins.vsts.plugin import VstsPlugin

WORK_ITEM_RESPONSE = """{
  "id": 309,
  "rev": 1,
  "fields": {
    "System.AreaPath": "Fabrikam-Fiber-Git",
    "System.TeamProject": "Fabrikam-Fiber-Git",
    "System.IterationPath": "Fabrikam-Fiber-Git",
    "System.WorkItemType": "Product Backlog Item",
    "System.State": "New",
    "System.Reason": "New backlog item",
    "System.CreatedDate": "2015-01-07T18:13:01.807Z",
    "System.CreatedBy": "Jamal Hartnett <fabrikamfiber4@hotmail.com>",
    "System.ChangedDate": "2015-01-07T18:13:01.807Z",
    "System.ChangedBy": "Jamal Hartnett <fabrikamfiber4@hotmail.com>",
    "System.Title": "Customer can sign in using their Microsoft Account",
    "Microsoft.VSTS.Scheduling.Effort": 8,
    "WEF_6CB513B6E70E43499D9FC94E5BBFB784_Kanban.Column": "New",
    "System.Description": "Our authorization logic needs to allow for users with Microsoft accounts (formerly Live Ids) - http://msdn.microsoft.com/en-us/library/live/hh826547.aspx"
  },
  "_links": {
    "self": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workItems/309"
    },
    "workItemUpdates": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workItems/309/updates"
    },
    "workItemRevisions": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workItems/309/revisions"
    },
    "workItemHistory": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workItems/309/history"
    },
    "html": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/web/wi.aspx?pcguid=d81542e4-cdfa-4333-b082-1ae2d6c3ad16&id=309"
    },
    "workItemType": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c/_apis/wit/workItemTypes/Product%20Backlog%20Item"
    },
    "fields": {
      "href": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/fields"
    }
  },
  "url": "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workItems/309"
}"""


class VstsPluginTest(PluginTestCase):
    @fixture
    def plugin(self):
        return VstsPlugin()

    @fixture
    def request(self):
        return RequestFactory()

    def test_conf_key(self):
        assert self.plugin.conf_key == "vsts"

    def test_entry_point(self):
        self.assertPluginInstalled("vsts", self.plugin)

    def test_get_issue_label(self):
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert self.plugin.get_issue_label(group, {"id": 309}) == "Bug 309"

    def test_get_issue_url(self):
        self.plugin.set_option("instance", "fabrikam-fiber-inc.visualstudio.com", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")
        assert (
            self.plugin.get_issue_url(
                group,
                {
                    "id": 309,
                    "url": "https://fabrikam-fiber-inc.visualstudio.com/DefaultProject/_workitems?id=309",
                },
            )
            == "https://fabrikam-fiber-inc.visualstudio.com/DefaultProject/_workitems?id=309"
        )

    def test_is_configured(self):
        assert self.plugin.is_configured(None, self.project) is False
        self.plugin.set_option("instance", "fabrikam-fiber-inc.visualstudio.com", self.project)
        assert self.plugin.is_configured(None, self.project) is True

    @responses.activate
    def test_create_issue(self):
        responses.add(
            responses.PATCH,
            "https://fabrikam-fiber-inc.visualstudio.com/DefaultProject/_apis/wit/workitems/$Bug",
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )

        self.plugin.set_option("instance", "fabrikam-fiber-inc.visualstudio.com", self.project)
        self.plugin.set_option("default_project", "DefaultProject", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")

        request = self.request.get("/")
        request.user = AnonymousUser()
        form_data = {"title": "Hello", "description": "Fix this."}
        with self.assertRaises(PluginError):
            self.plugin.create_issue(request, group, form_data)

        request.user = self.user
        self.login_as(self.user)
        UserSocialAuth.objects.create(
            user=self.user,
            provider=self.plugin.auth_provider,
            uid="a89e7204-9ca0-4680-ba7a-cfcf6b3c7445",
            extra_data={"access_token": "foo", "refresh_token": "bar"},
        )

        assert self.plugin.create_issue(request, group, form_data) == {
            "id": 309,
            "url": "https://fabrikam-fiber-inc.visualstudio.com/web/wi.aspx?pcguid=d81542e4-cdfa-4333-b082-1ae2d6c3ad16&id=309",
            "title": "Hello",
        }
        request = responses.calls[-1].request
        assert request.headers["Content-Type"] == "application/json-patch+json"
        payload = json.loads(request.body)
        assert payload == [
            {"op": "add", "path": "/fields/System.Title", "value": "Hello"},
            {"op": "add", "path": "/fields/System.History", "value": "<p>Fix this.</p>\n"},
            # {
            #     "op": "add",
            #     "path": "/relations/-",
            #     "value": {
            #         "rel": "Hyperlink",
            #         "url": 'http://testserver/baz/bar/issues/1/',
            #     }
            # }
        ]

    @responses.activate
    def test_link_issue_without_comment(self):
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workitems/309",
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )

        self.plugin.set_option("instance", "fabrikam-fiber-inc.visualstudio.com", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")

        request = self.request.get("/")
        request.user = AnonymousUser()
        form_data = {"item_id": "309"}
        with self.assertRaises(PluginError):
            self.plugin.link_issue(request, group, form_data)

        request.user = self.user
        self.login_as(self.user)
        UserSocialAuth.objects.create(
            user=self.user,
            provider=self.plugin.auth_provider,
            uid="a89e7204-9ca0-4680-ba7a-cfcf6b3c7445",
            extra_data={"access_token": "foo", "refresh_token": "bar"},
        )

        assert self.plugin.link_issue(request, group, form_data) == {
            "id": 309,
            "title": "Customer can sign in using their Microsoft Account",
            "url": "https://fabrikam-fiber-inc.visualstudio.com/web/wi.aspx?pcguid=d81542e4-cdfa-4333-b082-1ae2d6c3ad16&id=309",
        }

    @responses.activate
    def test_link_issue_with_comment(self):
        responses.add(
            responses.PATCH,
            "https://fabrikam-fiber-inc.visualstudio.com/DefaultCollection/_apis/wit/workitems/309",
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )

        self.plugin.set_option("instance", "fabrikam-fiber-inc.visualstudio.com", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")

        request = self.request.get("/")
        request.user = AnonymousUser()
        form_data = {"item_id": "309", "comment": "Fix this."}
        with self.assertRaises(PluginError):
            self.plugin.link_issue(request, group, form_data)

        request.user = self.user
        self.login_as(self.user)
        UserSocialAuth.objects.create(
            user=self.user,
            provider=self.plugin.auth_provider,
            uid="a89e7204-9ca0-4680-ba7a-cfcf6b3c7445",
            extra_data={"access_token": "foo", "refresh_token": "bar"},
        )

        assert self.plugin.link_issue(request, group, form_data) == {
            "id": 309,
            "title": "Customer can sign in using their Microsoft Account",
            "url": "https://fabrikam-fiber-inc.visualstudio.com/web/wi.aspx?pcguid=d81542e4-cdfa-4333-b082-1ae2d6c3ad16&id=309",
        }
        request = responses.calls[-1].request
        assert request.headers["Content-Type"] == "application/json-patch+json"
        payload = json.loads(request.body)
        assert payload == [
            {"op": "add", "path": "/fields/System.History", "value": "<p>Fix this.</p>\n"},
            # {
            #     "op": "add",
            #     "path": "/relations/-",
            #     "value": {
            #         "rel": "Hyperlink",
            #         "url": 'http://testserver/baz/bar/issues/1/',
            #     }
            # }
        ]

    @responses.activate
    def test_unlink_issue(self):
        self.plugin.set_option("instance", "fabrikam-fiber-inc.visualstudio.com", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")
        GroupMeta.objects.create(group=group, key="vsts:issue_id", value="309")

        request = self.request.get("/")
        request.user = self.user

        self.login_as(self.user)
        UserSocialAuth.objects.create(
            user=self.user,
            provider=self.plugin.auth_provider,
            uid="a89e7204-9ca0-4680-ba7a-cfcf6b3c7445",
            extra_data={"access_token": "foo", "refresh_token": "bar"},
        )

        assert self.plugin.unlink_issue(
            request,
            group,
            {
                "id": 309,
                "title": "Customer can sign in using their Microsoft Account",
                "url": "https://fabrikam-fiber-inc.visualstudio.com/web/wi.aspx?pcguid=d81542e4-cdfa-4333-b082-1ae2d6c3ad16&id=309",
            },
        )
