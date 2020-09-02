from __future__ import absolute_import

import responses
import pytest
import six

from exam import fixture
from django.test import RequestFactory
from time import time

from sentry.shared_integrations.exceptions import IntegrationError
from sentry.integrations.vsts.integration import VstsIntegration

from sentry.models import (
    ExternalIssue,
    Identity,
    IdentityProvider,
    Integration,
    IntegrationExternalProject,
)
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.utils import json

from .testutils import (
    WORK_ITEM_RESPONSE,
    WORK_ITEM_STATES,
    GET_PROJECTS_RESPONSE,
    GET_USERS_RESPONSE,
)


class VstsIssueBase(TestCase):
    @fixture
    def request(self):
        return RequestFactory()

    def setUp(self):
        model = Integration.objects.create(
            provider="vsts",
            external_id="vsts_external_id",
            name="fabrikam-fiber-inc",
            metadata={
                "domain_name": "https://fabrikam-fiber-inc.visualstudio.com/",
                "default_project": "0987654321",
            },
        )
        identity = Identity.objects.create(
            idp=IdentityProvider.objects.create(type="vsts", config={}),
            user=self.user,
            external_id="vsts",
            data={"access_token": "123456789", "expires": time() + 1234567},
        )
        model.add_organization(self.organization, self.user, identity.id)
        self.config = {
            "resolve_status": "Resolved",
            "resolve_when": "Resolved",
            "regression_status": "Active",
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
        }
        self.integration = VstsIntegration(model, self.organization.id)
        self.issue_id = "309"
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workitemtypes/Bug/states",
            json=WORK_ITEM_STATES,
        )
        self.project_id_with_states = "c0bf429a-c03c-4a99-9336-d45be74db5a6"


class VstsIssueSyncTest(VstsIssueBase):
    def tearDown(self):
        responses.reset()

    @responses.activate
    def test_create_issue(self):
        responses.add(
            responses.PATCH,
            "https://fabrikam-fiber-inc.visualstudio.com/0987654321/_apis/wit/workitems/$Microsoft.VSTS.WorkItemTypes.Task?api-version=3.0",
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )

        form_data = {
            "title": "Hello",
            "description": "Fix this.",
            "project": "0987654321",
            "work_item_type": "Microsoft.VSTS.WorkItemTypes.Task",
        }
        assert self.integration.create_issue(form_data) == {
            "key": self.issue_id,
            "description": "Fix this.",
            "title": "Hello",
            "metadata": {"display_name": u"Fabrikam-Fiber-Git#309"},
        }
        request = responses.calls[-1].request
        assert request.headers["Content-Type"] == "application/json-patch+json"
        payload = json.loads(request.body)
        assert payload == [
            {"op": "add", "path": "/fields/System.Title", "value": "Hello"},
            # Adds both a comment and a description.
            # See method for details.
            {"op": "add", "path": "/fields/System.Description", "value": "<p>Fix this.</p>\n"},
            {"op": "add", "path": "/fields/System.History", "value": "<p>Fix this.</p>\n"},
        ]

    @responses.activate
    def test_get_issue(self):
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/%s" % self.issue_id,
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )
        assert self.integration.get_issue(self.issue_id) == {
            "key": self.issue_id,
            "description": "Fix this.",
            "title": "Hello",
            "metadata": {"display_name": u"Fabrikam-Fiber-Git#309"},
        }
        request = responses.calls[-1].request
        assert request.headers["Content-Type"] == "application/json"

    @responses.activate
    def test_sync_assignee_outbound(self):
        vsts_work_item_id = 5
        responses.add(
            responses.PATCH,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/%d"
            % vsts_work_item_id,
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users",
            body=GET_USERS_RESPONSE,
            content_type="application/json",
        )

        user = self.create_user("ftotten@vscsi.us")
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.model.id,
            key=vsts_work_item_id,
            title="I'm a title!",
            description="I'm a description.",
        )
        self.integration.sync_assignee_outbound(external_issue, user, assign=True)
        assert len(responses.calls) == 2
        assert (
            responses.calls[0].request.url
            == "https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users"
        )
        assert responses.calls[0].response.status_code == 200
        assert (
            responses.calls[1].request.url
            == "https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/%d"
            % vsts_work_item_id
        )

        request_body = json.loads(responses.calls[1].request.body)
        assert len(request_body) == 1
        assert request_body[0]["path"] == "/fields/System.AssignedTo"
        assert request_body[0]["value"] == "ftotten@vscsi.us"
        assert request_body[0]["op"] == "replace"
        assert responses.calls[1].response.status_code == 200

    @responses.activate
    def test_sync_assignee_outbound_with_paging(self):
        vsts_work_item_id = 5
        responses.add(
            responses.PATCH,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/%d"
            % vsts_work_item_id,
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users",
            json={
                "value": [
                    {"mailAddress": "example1@example.com"},
                    {"mailAddress": "example2@example.com"},
                    {"mailAddress": "example3@example.com"},
                ]
            },
            headers={"X-MS-ContinuationToken": "continuation-token"},
            match_querystring=True,
        )
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users?continuationToken=continuation-token",
            body=GET_USERS_RESPONSE,
            content_type="application/json",
            match_querystring=True,
        )

        user = self.create_user("ftotten@vscsi.us")
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.model.id,
            key=vsts_work_item_id,
            title="I'm a title!",
            description="I'm a description.",
        )
        self.integration.sync_assignee_outbound(external_issue, user, assign=True)
        assert len(responses.calls) == 3
        assert (
            responses.calls[0].request.url
            == "https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users"
        )
        assert responses.calls[0].response.status_code == 200

        assert (
            responses.calls[1].request.url
            == "https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users?continuationToken=continuation-token"
        )
        assert responses.calls[1].response.status_code == 200

        assert (
            responses.calls[2].request.url
            == "https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/%d"
            % vsts_work_item_id
        )
        request_body = json.loads(responses.calls[2].request.body)
        assert len(request_body) == 1
        assert request_body[0]["path"] == "/fields/System.AssignedTo"
        assert request_body[0]["value"] == "ftotten@vscsi.us"
        assert request_body[0]["op"] == "replace"
        assert responses.calls[2].response.status_code == 200

    @responses.activate
    def test_sync_status_outbound(self):
        vsts_work_item_id = 5
        responses.add(
            responses.PATCH,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/%d"
            % vsts_work_item_id,
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users",
            body=GET_USERS_RESPONSE,
            content_type="application/json",
        )
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/%d"
            % vsts_work_item_id,
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/projects",
            body=GET_PROJECTS_RESPONSE,
            content_type="application/json",
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.model.id,
            key=vsts_work_item_id,
            title="I'm a title!",
            description="I'm a description.",
        )

        IntegrationExternalProject.objects.create(
            external_id="ac7c05bb-7f8e-4880-85a6-e08f37fd4a10",
            organization_integration_id=self.integration.org_integration.id,
            resolved_status="Resolved",
            unresolved_status="New",
        )
        self.integration.sync_status_outbound(external_issue, True, self.project.id)
        assert len(responses.calls) == 3
        req = responses.calls[2].request
        assert (
            req.url
            == "https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/%d"
            % vsts_work_item_id
        )
        assert json.loads(req.body) == [
            {"path": "/fields/System.State", "value": "Resolved", "op": "replace"}
        ]
        assert responses.calls[2].response.status_code == 200

    def test_get_issue_url(self):
        work_id = 345
        url = self.integration.get_issue_url(work_id)
        assert url == "https://fabrikam-fiber-inc.visualstudio.com/_workitems/edit/345"

    @responses.activate
    def test_should_resolve_active_to_resolved(self):
        should_resolve = self.integration.should_resolve(
            {"project": self.project_id_with_states, "old_state": "Active", "new_state": "Resolved"}
        )
        assert should_resolve is True

    @responses.activate
    def test_should_resolve_resolved_to_active(self):
        should_resolve = self.integration.should_resolve(
            {"project": self.project_id_with_states, "old_state": "Resolved", "new_state": "Active"}
        )
        assert should_resolve is False

    @responses.activate
    def test_should_resolve_new(self):
        should_resolve = self.integration.should_resolve(
            {"project": self.project_id_with_states, "old_state": None, "new_state": "New"}
        )
        assert should_resolve is False

    @responses.activate
    def test_should_resolve_done_status_failure(self):
        responses.reset()
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workitemtypes/Bug/states",
            status=403,
            json={
                "error": "The requested operation is not allowed. Your account is pending deletion."
            },
        )
        should_resolve = self.integration.should_resolve(
            {"project": self.project_id_with_states, "old_state": "Active", "new_state": "Resolved"}
        )
        assert should_resolve is False

    @responses.activate
    def test_should_unresolve_active_to_resolved(self):
        should_unresolve = self.integration.should_unresolve(
            {"project": self.project_id_with_states, "old_state": "Active", "new_state": "Resolved"}
        )
        assert should_unresolve is False

    @responses.activate
    def test_should_unresolve_resolved_to_active(self):
        should_unresolve = self.integration.should_unresolve(
            {"project": self.project_id_with_states, "old_state": "Resolved", "new_state": "Active"}
        )
        assert should_unresolve is True

    @responses.activate
    def test_should_unresolve_new(self):
        should_unresolve = self.integration.should_unresolve(
            {"project": self.project_id_with_states, "old_state": None, "new_state": "New"}
        )
        assert should_unresolve is True


class VstsIssueFormTest(VstsIssueBase):
    def setUp(self):
        super(VstsIssueFormTest, self).setUp()
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/projects",
            json={
                "value": [
                    {"id": "project-1-id", "name": "project_1"},
                    {"id": "project-2-id", "name": "project_2"},
                ]
            },
        )
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )
        self.group = event.group

    def mock_categories(self, project):
        responses.add(
            responses.GET,
            u"https://fabrikam-fiber-inc.visualstudio.com/{}/_apis/wit/workitemtypecategories".format(
                project
            ),
            json={
                "value": [
                    {
                        "workItemTypes": [
                            {
                                "url": u"https://fabrikam-fiber-inc.visualstudio.com/{}/wit/workItemTypeCategories/Microsoft.VSTS.WorkItemTypes.Bug".format(
                                    project
                                ),
                                "name": "Bug",
                            }
                        ],
                    },
                    {
                        "workItemTypes": [
                            {
                                "url": u"https://fabrikam-fiber-inc.visualstudio.com/{}/wit/workItemTypeCategories/Microsoft.VSTS.WorkItemTypes.Bug".format(
                                    project
                                ),
                                "name": "Issue Bug",
                            },
                            {
                                "url": u"https://fabrikam-fiber-inc.visualstudio.com/{}/wit/workItemTypeCategories/Some-Thing.GIssue".format(
                                    project
                                ),
                                "name": "G Issue",
                            },
                        ],
                    },
                    {
                        "workItemTypes": [
                            {
                                "url": u"https://fabrikam-fiber-inc.visualstudio.com/{}/wit/workItemTypeCategories/Microsoft.VSTS.WorkItemTypes.Task".format(
                                    project
                                ),
                                "name": "Task",
                            }
                        ],
                    },
                    {
                        "workItemTypes": [
                            {
                                "url": u"https://fabrikam-fiber-inc.visualstudio.com/{}/wit/workItemTypeCategories/Microsoft.VSTS.WorkItemTypes.UserStory".format(
                                    project
                                ),
                                "name": "User Story",
                            }
                        ],
                    },
                ]
            },
        )

    def tearDown(self):
        responses.reset()

    def update_issue_defaults(self, defaults):
        self.integration.org_integration.config = {
            "project_issue_defaults": {six.text_type(self.group.project_id): defaults}
        }
        self.integration.org_integration.save()

    def assert_project_field(self, fields, default_value, choices):
        project_field = [field for field in fields if field["name"] == "project"][0]
        assert project_field["defaultValue"] == default_value
        assert project_field["choices"] == choices

    def assert_work_item_type_field(self, fields, default_value, choices):
        project_field = [field for field in fields if field["name"] == "work_item_type"][0]
        assert project_field["defaultValue"] == default_value
        assert project_field["choices"] == choices

    @responses.activate
    def test_default_project(self):
        self.mock_categories("project-2-id")
        self.update_issue_defaults({"project": "project-2-id"})
        fields = self.integration.get_create_issue_config(self.group)

        self.assert_project_field(
            fields, "project-2-id", [("project-1-id", "project_1"), ("project-2-id", "project_2")]
        )

    @responses.activate
    def test_default_project_and_category(self):
        self.mock_categories("project-2-id")
        self.update_issue_defaults({"project": "project-2-id", "work_item_type": "Task"})
        fields = self.integration.get_create_issue_config(self.group)

        self.assert_project_field(
            fields, "project-2-id", [("project-1-id", "project_1"), ("project-2-id", "project_2")]
        )

        self.assert_work_item_type_field(
            fields,
            "Task",
            [
                ("Microsoft.VSTS.WorkItemTypes.Bug", "Bug"),
                ("Some-Thing.GIssue", "G Issue"),
                ("Microsoft.VSTS.WorkItemTypes.Task", "Task"),
                ("Microsoft.VSTS.WorkItemTypes.UserStory", "User Story"),
            ],
        )

    @responses.activate
    def test_default_project_default_missing_in_choices(self):
        self.mock_categories("project-3-id")
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/projects/project-3-id",
            json={"id": "project-3-id", "name": "project_3"},
        )
        self.update_issue_defaults({"project": "project-3-id"})
        fields = self.integration.get_create_issue_config(self.group)

        self.assert_project_field(
            fields,
            "project-3-id",
            [
                ("project-3-id", "project_3"),
                ("project-1-id", "project_1"),
                ("project-2-id", "project_2"),
            ],
        )

    @responses.activate
    def test_default_project_error_on_default_project(self):
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/projects/project-3-id",
            status=404,
        )
        self.update_issue_defaults({"project": "project-3-id"})
        fields = self.integration.get_create_issue_config(self.group)

        self.assert_project_field(
            fields, None, [("project-1-id", "project_1"), ("project-2-id", "project_2")]
        )

    @responses.activate
    def test_get_create_issue_config_error_on_get_projects(self):
        responses.reset()
        responses.add(
            responses.GET, "https://fabrikam-fiber-inc.visualstudio.com/_apis/projects", status=503
        )

        with pytest.raises(IntegrationError):
            self.integration.get_create_issue_config(self.group)

    @responses.activate
    def test_default_project_no_projects(self):
        responses.reset()
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/projects",
            json={"value": []},
        )
        fields = self.integration.get_create_issue_config(self.group)

        self.assert_project_field(fields, None, [])
