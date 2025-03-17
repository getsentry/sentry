from __future__ import annotations

from time import time
from typing import Any
from unittest.mock import patch

import orjson
import pytest
import responses
from django.test import override_settings
from responses import matchers

from fixtures.vsts import (
    GET_PROJECTS_RESPONSE,
    GET_USERS_RESPONSE,
    WORK_ITEM_RESPONSE,
    WORK_ITEM_STATES,
)
from sentry.integrations.mixins import ResolveSyncAction
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.services.integration import integration_service
from sentry.integrations.vsts.integration import VstsIntegration
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_PATH
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.users.models.identity import Identity
from sentry.users.services.user.service import user_service

pytestmark = [requires_snuba]


def generate_mock_response(*, method: str, non_region_url: str, path: str, **kwargs):
    if SiloMode.get_current_mode() == SiloMode.REGION:
        match: list[Any] | None = kwargs.pop("match", None)
        if match is None:
            match = [matchers.header_matcher({PROXY_PATH: path})]
        else:
            match.append(matchers.header_matcher({PROXY_PATH: path}))

        responses.add(
            method=method,
            url="http://controlserver/api/0/internal/integration-proxy/",
            match=match,
            **kwargs,
        )
    else:
        responses.add(method=method, url=non_region_url, **kwargs)


def assert_response_calls(expected_region_response, expected_non_region_response):
    assert len(expected_region_response) == len(expected_non_region_response)
    if SiloMode.get_current_mode() == SiloMode.REGION:
        for index, path in enumerate(expected_region_response):
            assert (
                responses.calls[index].request.url
                == "http://controlserver/api/0/internal/integration-proxy/"
            )
            assert responses.calls[index].request.headers[PROXY_PATH] == path

            assert responses.calls[index].response.status_code == 200
    else:
        for index, path in enumerate(expected_non_region_response):
            assert responses.calls[index].request.url == path
            assert responses.calls[index].response.status_code == 200


class VstsIssueBase(TestCase):
    def setUp(self):
        with assume_test_silo_mode(SiloMode.CONTROL):
            model = self.create_provider_integration(
                provider="vsts",
                external_id="vsts_external_id",
                name="fabrikam-fiber-inc",
                metadata={
                    "domain_name": "https://fabrikam-fiber-inc.visualstudio.com/",
                    "default_project": "0987654321",
                },
            )
            identity = Identity.objects.create(
                idp=self.create_identity_provider(type="vsts"),
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

    def mock_categories(self, project):
        responses.add(
            responses.GET,
            f"https://fabrikam-fiber-inc.visualstudio.com/{project}/_apis/wit/workitemtypecategories",
            json={
                "value": [
                    {
                        "workItemTypes": [
                            {
                                "url": f"https://fabrikam-fiber-inc.visualstudio.com/{project}/wit/workItemTypeCategories/Microsoft.VSTS.WorkItemTypes.Bug",
                                "name": "Bug",
                            }
                        ],
                    },
                    {
                        "workItemTypes": [
                            {
                                "url": f"https://fabrikam-fiber-inc.visualstudio.com/{project}/wit/workItemTypeCategories/Microsoft.VSTS.WorkItemTypes.Bug",
                                "name": "Issue Bug",
                            },
                            {
                                "url": f"https://fabrikam-fiber-inc.visualstudio.com/{project}/wit/workItemTypeCategories/Some-Thing.GIssue",
                                "name": "G Issue",
                            },
                        ],
                    },
                    {
                        "workItemTypes": [
                            {
                                "url": f"https://fabrikam-fiber-inc.visualstudio.com/{project}/wit/workItemTypeCategories/Microsoft.VSTS.WorkItemTypes.Task",
                                "name": "Task",
                            }
                        ],
                    },
                    {
                        "workItemTypes": [
                            {
                                "url": f"https://fabrikam-fiber-inc.visualstudio.com/{project}/wit/workItemTypeCategories/Microsoft.VSTS.WorkItemTypes.UserStory",
                                "name": "User Story",
                            }
                        ],
                    },
                ]
            },
        )


@override_settings(
    SENTRY_SUBNET_SECRET="hush-hush-im-invisible",
    SENTRY_CONTROL_ADDRESS="http://controlserver",
)
@region_silo_test(include_monolith_run=True)
class VstsIssueSyncTest(VstsIssueBase):
    def tearDown(self):
        responses.reset()

    @responses.activate
    def test_create_issue(self):
        responses.add(
            responses.PATCH,
            "https://fabrikam-fiber-inc.visualstudio.com/0987654321/_apis/wit/workitems/$Microsoft.VSTS.WorkItemTypes.Task",
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
            "metadata": {"display_name": "Fabrikam-Fiber-Git#309"},
        }
        request = responses.calls[-1].request
        assert request.headers["Content-Type"] == "application/json-patch+json"
        payload = orjson.loads(request.body)
        assert payload == [
            {"op": "add", "path": "/fields/System.Title", "value": "Hello"},
            # Adds both a comment and a description.
            # See method for details.
            {"op": "add", "path": "/fields/System.Description", "value": "<p>Fix this.</p>\n"},
            {"op": "add", "path": "/fields/System.History", "value": "<p>Fix this.</p>\n"},
        ]

    @responses.activate
    def test_create_issue_failure(self):
        form_data = {
            "title": "rip",
            "description": "Goodnight, sweet prince",
        }

        with pytest.raises(ValueError):
            self.integration.create_issue(form_data)

    @responses.activate
    def test_get_issue(self):
        responses.add(
            responses.GET,
            f"https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/{self.issue_id}",
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
        )
        assert self.integration.get_issue(self.issue_id) == {
            "key": self.issue_id,
            "description": "Fix this.",
            "title": "Hello",
            "metadata": {"display_name": "Fabrikam-Fiber-Git#309"},
        }
        request = responses.calls[-1].request
        assert request.headers["Content-Type"] == "application/json"

    @responses.activate
    @patch("sentry.integrations.vsts.client.VstsApiClient._use_proxy_url_for_tests")
    def test_sync_assignee_outbound(self, use_proxy_url_for_tests):
        use_proxy_url_for_tests.return_value = True
        vsts_work_item_id = 5
        generate_mock_response(
            method=responses.PATCH,
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
            path=f"_apis/wit/workitems/{vsts_work_item_id}",
            non_region_url=f"https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/{vsts_work_item_id}",
        )
        generate_mock_response(
            method=responses.GET,
            body=GET_USERS_RESPONSE,
            content_type="application/json",
            path="_apis/graph/users",
            non_region_url="https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users",
        )

        user = user_service.get_user(user_id=self.create_user("ftotten@vscsi.us").id)
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.model.id,
            key=vsts_work_item_id,
            title="I'm a title!",
            description="I'm a description.",
        )
        self.integration.sync_assignee_outbound(external_issue, user, assign=True)
        assert len(responses.calls) == 2
        assert_response_calls(
            expected_region_response=[
                "_apis/graph/users",
                f"_apis/wit/workitems/{vsts_work_item_id}",
            ],
            expected_non_region_response=[
                "https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users",
                f"https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/{vsts_work_item_id}",
            ],
        )

        request_body = orjson.loads(responses.calls[1].request.body)
        assert len(request_body) == 1
        assert request_body[0]["path"] == "/fields/System.AssignedTo"
        assert request_body[0]["value"] == "ftotten@vscsi.us"
        assert request_body[0]["op"] == "replace"
        assert responses.calls[1].response.status_code == 200

    @responses.activate
    @patch("sentry.integrations.vsts.client.VstsApiClient._use_proxy_url_for_tests")
    def test_sync_assignee_outbound_with_paging(self, use_proxy_url_for_tests):
        use_proxy_url_for_tests.return_value = True
        vsts_work_item_id = 5
        generate_mock_response(
            method=responses.PATCH,
            body=WORK_ITEM_RESPONSE,
            content_type="application/json",
            path=f"_apis/wit/workitems/{vsts_work_item_id}",
            non_region_url=f"https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/{vsts_work_item_id}",
        )
        generate_mock_response(
            method=responses.GET,
            json={
                "value": [
                    {"mailAddress": "example1@example.com"},
                    {"mailAddress": "example2@example.com"},
                    {"mailAddress": "example3@example.com"},
                ]
            },
            headers={"X-MS-ContinuationToken": "continuation-token"},
            path="_apis/graph/users",
            non_region_url="https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users",
        )
        generate_mock_response(
            method=responses.GET,
            body=GET_USERS_RESPONSE,
            content_type="application/json",
            path="_apis/graph/users?continuationToken=continuation-token",
            non_region_url="https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users",
        )

        user = user_service.get_user(user_id=self.create_user("ftotten@vscsi.us").id)
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.model.id,
            key=vsts_work_item_id,
            title="I'm a title!",
            description="I'm a description.",
        )
        self.integration.sync_assignee_outbound(external_issue, user, assign=True)
        assert len(responses.calls) == 3
        assert_response_calls(
            expected_region_response=[
                "_apis/graph/users",
                "_apis/graph/users?continuationToken=continuation-token",
                f"_apis/wit/workitems/{vsts_work_item_id}",
            ],
            expected_non_region_response=[
                "https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users",
                "https://fabrikam-fiber-inc.vssps.visualstudio.com/_apis/graph/users?continuationToken=continuation-token",
                f"https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/{vsts_work_item_id}",
            ],
        )

        request_body = orjson.loads(responses.calls[2].request.body)
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
            f"https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/{vsts_work_item_id}",
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
            f"https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/{vsts_work_item_id}",
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

        with assume_test_silo_mode(SiloMode.CONTROL):
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
            == f"https://fabrikam-fiber-inc.visualstudio.com/_apis/wit/workitems/{vsts_work_item_id}"
        )
        assert orjson.loads(req.body) == [
            {"path": "/fields/System.State", "value": "Resolved", "op": "replace"}
        ]
        assert responses.calls[2].response.status_code == 200

    def test_get_issue_url(self):
        work_id = 345
        url = self.integration.get_issue_url(work_id)
        assert url == "https://fabrikam-fiber-inc.visualstudio.com/_workitems/edit/345"

    @responses.activate
    def test_should_resolve_active_to_resolved(self):
        assert (
            self.integration.get_resolve_sync_action(
                {
                    "project": self.project_id_with_states,
                    "old_state": "Active",
                    "new_state": "Resolved",
                }
            )
            == ResolveSyncAction.RESOLVE
        )

    @responses.activate
    def test_should_resolve_resolved_to_active(self):
        assert (
            self.integration.get_resolve_sync_action(
                {
                    "project": self.project_id_with_states,
                    "old_state": "Resolved",
                    "new_state": "Active",
                }
            )
            == ResolveSyncAction.UNRESOLVE
        )

    @responses.activate
    def test_should_resolve_new(self):
        assert (
            self.integration.get_resolve_sync_action(
                {"project": self.project_id_with_states, "old_state": None, "new_state": "New"}
            )
            == ResolveSyncAction.UNRESOLVE
        )

    @responses.activate
    def test_should_resolve_done_status_failure(self):
        """TODO(mgaeta): Should this be NOOP instead of UNRESOLVE when we lose connection?"""
        responses.reset()
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/c0bf429a-c03c-4a99-9336-d45be74db5a6/_apis/wit/workitemtypes/Bug/states",
            status=403,
            json={
                "error": "The requested operation is not allowed. Your account is pending deletion."
            },
        )

        assert (
            self.integration.get_resolve_sync_action(
                {
                    "project": self.project_id_with_states,
                    "old_state": "Active",
                    "new_state": "Resolved",
                }
            )
            == ResolveSyncAction.UNRESOLVE
        )

    @responses.activate
    def test_should_not_unresolve_resolved_to_closed(self):
        assert (
            self.integration.get_resolve_sync_action(
                {
                    "project": self.project_id_with_states,
                    "old_state": "Resolved",
                    "new_state": "Closed",
                }
            )
            == ResolveSyncAction.NOOP
        )


@region_silo_test(include_monolith_run=True)
class VstsIssueFormTest(VstsIssueBase):
    def setUp(self):
        super().setUp()
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/projects",
            json={
                "value": [
                    {"id": "project-1-id", "name": "project_1"},
                    {"id": "project-2-id", "name": "project_2"},
                ],
                "count": 2,
            },
        )
        min_ago = before_now(minutes=1).isoformat()
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )
        self.group = event.group

    def tearDown(self):
        responses.reset()

    def update_issue_defaults(self, defaults):
        self.integration.org_integration = integration_service.update_organization_integration(
            org_integration_id=self.integration.org_integration.id,
            config={"project_issue_defaults": {str(self.group.project_id): defaults}},
        )

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
        fields = self.integration.get_create_issue_config(self.group, self.user)

        self.assert_project_field(
            fields, "project-2-id", [("project-1-id", "project_1"), ("project-2-id", "project_2")]
        )

    @responses.activate
    def test_default_project_and_category(self):
        self.mock_categories("project-2-id")
        self.update_issue_defaults({"project": "project-2-id", "work_item_type": "Task"})
        fields = self.integration.get_create_issue_config(self.group, self.user)

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
        fields = self.integration.get_create_issue_config(self.group, self.user)

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
        fields = self.integration.get_create_issue_config(self.group, self.user)

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
            self.integration.get_create_issue_config(self.group, self.user)

    @responses.activate
    def test_default_project_no_projects(self):
        responses.reset()
        responses.add(
            responses.GET,
            "https://fabrikam-fiber-inc.visualstudio.com/_apis/projects",
            json={"value": [], "count": 0},
        )
        fields = self.integration.get_create_issue_config(self.group, self.user)

        self.assert_project_field(fields, None, [])
