from functools import cached_property
from unittest import mock
from unittest.mock import patch

import orjson
import pytest
import responses
from django.db import router
from django.urls import reverse

from fixtures.integrations.jira.stub_client import StubJiraApiClient
from fixtures.integrations.stub_service import StubService
from sentry.integrations.jira_server.integration import JiraServerIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.models.grouplink import GroupLink
from sentry.models.groupmeta import GroupMeta
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized, IntegrationError
from sentry.silo.base import SiloMode
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.utils.http import absolute_uri
from sentry_plugins.jira.plugin import JiraPlugin

from . import EXAMPLE_PRIVATE_KEY

pytestmark = [requires_snuba]

DEFAULT_PROJECT_ID = 10000
DEFAULT_ISSUE_TYPE_ID = 10000


def get_client():
    return StubJiraApiClient()


class JiraServerIntegrationBaseTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1).isoformat()
        (
            self.integration,
            self.org_integration,
            self.identity,
            self.identity_provider,
        ) = self.create_identity_integration(
            user=self.user,
            organization=self.organization,
            integration_params={
                "provider": "jira_server",
                "external_id": "jira.example.org:sentry-test",
                "name": "Example Jira",
                "metadata": {
                    "verify_ssl": False,
                    "webhook_secret": "a long secret value",
                    "base_url": "https://jira.example.org",
                },
            },
            identity_params={
                "external_id": "jira.example.org:user_id",
                "data": {
                    "consumer_key": "sentry-test",
                    "private_key": EXAMPLE_PRIVATE_KEY,
                    "access_token": "access-token",
                    "access_token_secret": "access-token-secret",
                },
            },
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.name = "Sentry Admin"
            self.user.save()
        installation = self.integration.get_installation(self.organization.id)
        assert isinstance(installation, JiraServerIntegration)
        self.installation = installation
        self.login_as(self.user)


class JiraServerRegionIntegrationTest(JiraServerIntegrationBaseTest):
    def test_get_create_issue_config(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group = event.group
        assert group is not None
        search_url = reverse(
            "sentry-extensions-jiraserver-search",
            args=[self.organization.slug, self.integration.id],
        )
        with mock.patch.object(self.installation, "get_client", get_client):
            assert self.installation.get_create_issue_config(group, self.user) == [
                {
                    "name": "project",
                    "label": "Jira Project",
                    "choices": [("10000", "EX"), ("10001", "ABC")],
                    "default": "10000",
                    "type": "select",
                    "updatesForm": True,
                },
                {
                    "name": "title",
                    "label": "Title",
                    "default": "message",
                    "type": "string",
                    "required": True,
                },
                {
                    "name": "description",
                    "label": "Description",
                    "default": (
                        "Sentry Issue: [%s|%s]\n\n{code}\n"
                        "Stacktrace (most recent call first):\n\n  "
                        'File "sentry/models/foo.py", line 29, in build_msg\n    '
                        "string_max_length=self.string_max_length)\n\nmessage\n{code}"
                    )
                    % (
                        group.qualified_short_id,
                        absolute_uri(
                            group.get_absolute_url(params={"referrer": "jira_integration"})
                        ),
                    ),
                    "type": "textarea",
                    "autosize": True,
                    "maxRows": 10,
                },
                {
                    "name": "issuetype",
                    "label": "Issue Type",
                    "default": "10000",
                    "type": "select",
                    "choices": [
                        ("10000", "Epic"),
                        ("10001", "Story"),
                        ("10002", "Task"),
                        ("10003", "Sub-task"),
                        ("10004", "Bug"),
                    ],
                    "updatesForm": True,
                    "required": True,
                },
                {
                    "label": "Priority",
                    "required": False,
                    "choices": [
                        ("1", "Highest"),
                        ("2", "High"),
                        ("3", "Medium"),
                        ("4", "Low"),
                        ("5", "Lowest"),
                    ],
                    "type": "select",
                    "name": "priority",
                    "default": "",
                },
                {
                    "label": "Fix Version/s",
                    "required": False,
                    "multiple": True,
                    "choices": [("10000", "v1"), ("10001", "v2"), ("10002", "v3")],
                    "default": "",
                    "type": "select",
                    "name": "fixVersions",
                },
                {
                    "label": "Component/s",
                    "required": False,
                    "multiple": True,
                    "choices": [("10000", "computers"), ("10001", "software")],
                    "default": "",
                    "type": "select",
                    "name": "components",
                },
                {
                    "label": "Assignee",
                    "required": False,
                    "url": search_url,
                    "choices": [],
                    "type": "select",
                    "name": "assignee",
                },
                {
                    "label": "Sprint",
                    "required": False,
                    "url": search_url,
                    "choices": [],
                    "type": "select",
                    "name": "customfield_10100",
                },
                {
                    "label": "Epic Link",
                    "required": False,
                    "url": search_url,
                    "choices": [],
                    "type": "select",
                    "name": "customfield_10101",
                },
                {
                    "label": "Mood",
                    "required": False,
                    "choices": [("sad", "sad"), ("happy", "happy")],
                    "default": "",
                    "type": "select",
                    "name": "customfield_10200",
                },
                {
                    "label": "reactions",
                    "required": False,
                    "multiple": True,
                    "choices": [("wow", "wow"), ("devil", "devil"), ("metal", "metal")],
                    "default": "",
                    "type": "select",
                    "name": "customfield_10201",
                },
                {
                    "label": "Feature",
                    "required": False,
                    "multiple": True,
                    "choices": [
                        ("Feature 1", "Feature 1"),
                        ("Feature 2", "Feature 2"),
                        ("Feature 3", "Feature 3"),
                    ],
                    "default": "",
                    "type": "select",
                    "name": "customfield_10202",
                },
                {"label": "Environment", "required": False, "type": "text", "name": "environment"},
                {
                    "label": "Labels",
                    "required": False,
                    "type": "text",
                    "name": "labels",
                    "default": "",
                },
                {
                    "label": "Reporter",
                    "required": True,
                    "url": search_url,
                    "choices": [],
                    "type": "select",
                    "name": "reporter",
                },
                {
                    "label": "Affects Version/s",
                    "required": False,
                    "multiple": True,
                    "choices": [("10000", "v1"), ("10001", "v2"), ("10002", "v3")],
                    "default": "",
                    "type": "select",
                    "name": "versions",
                },
            ]

    def test_get_create_issue_config_with_persisted_reporter(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group = event.group

        # When persisted reporter matches a user JIRA knows about, a default is picked.
        account_id = StubService.get_stub_data("jira", "user.json")["accountId"]
        self.installation.store_issue_last_defaults(
            self.project, self.user, {"reporter": account_id}
        )
        with mock.patch.object(self.installation, "get_client", get_client):
            create_issue_config = self.installation.get_create_issue_config(group, self.user)
        reporter_field = [field for field in create_issue_config if field["name"] == "reporter"][0]
        assert reporter_field == {
            "name": "reporter",
            "url": reverse(
                "sentry-extensions-jiraserver-search",
                args=[self.organization.slug, self.integration.id],
            ),
            "required": True,
            "choices": [("012345:00000000-1111-2222-3333-444444444444", "Saif Hakim")],
            "default": "012345:00000000-1111-2222-3333-444444444444",
            "label": "Reporter",
            "type": "select",
        }

        # When persisted reporter does not match a user JIRA knows about, field is left blank.
        self.installation.store_issue_last_defaults(
            self.project, self.user, {"reporter": "invalid-reporter-id"}
        )

        with mock.patch.object(self.installation, "get_client", get_client):
            create_issue_config = self.installation.get_create_issue_config(group, self.user)
        reporter_field = [field for field in create_issue_config if field["name"] == "reporter"][0]
        assert reporter_field == {
            "name": "reporter",
            "url": reverse(
                "sentry-extensions-jiraserver-search",
                args=[self.organization.slug, self.integration.id],
            ),
            "required": True,
            "choices": [],
            "label": "Reporter",
            "type": "select",
        }

    def test_get_create_issue_config_with_ignored_fields(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group = event.group

        with mock.patch.object(self.installation, "get_client", get_client):
            # Initially all fields are present
            fields = self.installation.get_create_issue_config(group, self.user)
            field_names = [field["name"] for field in fields]
            assert field_names == [
                "project",
                "title",
                "description",
                "issuetype",
                "priority",
                "fixVersions",
                "components",
                "assignee",
                "customfield_10100",
                "customfield_10101",
                "customfield_10200",
                "customfield_10201",
                "customfield_10202",
                "environment",
                "labels",
                "reporter",
                "versions",
            ]
            # After ignoring "customfield_10200", it no longer shows up
            assert self.installation.org_integration is not None
            org_integration = integration_service.update_organization_integration(
                org_integration_id=self.installation.org_integration.id,
                config={"issues_ignored_fields": ["customfield_10200"]},
            )
            assert org_integration is not None
            self.installation.org_integration = org_integration
            fields = self.installation.get_create_issue_config(group, self.user)
            field_names = [field["name"] for field in fields]
            assert field_names == [
                "project",
                "title",
                "description",
                "issuetype",
                "priority",
                "fixVersions",
                "components",
                "assignee",
                "customfield_10100",
                "customfield_10101",
                "customfield_10201",
                "customfield_10202",
                "environment",
                "labels",
                "reporter",
                "versions",
            ]

    def test_get_create_issue_config_with_default_and_param(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group = event.group
        assert group is not None

        assert self.installation.org_integration is not None
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.installation.org_integration.id,
            config={"project_issue_defaults": {str(group.project_id): {"project": "10001"}}},
        )
        assert org_integration is not None
        self.installation.org_integration = org_integration

        with mock.patch.object(self.installation, "get_client", get_client):
            fields = self.installation.get_create_issue_config(
                group, self.user, params={"project": "10000"}
            )
            project_field = [field for field in fields if field["name"] == "project"][0]

            assert project_field == {
                "default": "10000",
                "choices": [("10000", "EX"), ("10001", "ABC")],
                "type": "select",
                "name": "project",
                "label": "Jira Project",
                "updatesForm": True,
            }

    def test_get_create_issue_config_with_default(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group = event.group
        assert group is not None
        assert self.installation.org_integration is not None
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.installation.org_integration.id,
            config={"project_issue_defaults": {str(group.project_id): {"project": "10001"}}},
        )
        assert org_integration is not None
        self.installation.org_integration = org_integration

        with mock.patch.object(self.installation, "get_client", get_client):
            fields = self.installation.get_create_issue_config(group, self.user)
            project_field = [field for field in fields if field["name"] == "project"][0]

            assert project_field == {
                "default": "10001",
                "choices": [("10000", "EX"), ("10001", "ABC")],
                "type": "select",
                "name": "project",
                "label": "Jira Project",
                "updatesForm": True,
            }

    @responses.activate
    def test_get_create_issue_config_with_default_project_issue_types_erroring(self):
        """Test that if you have a default project set that's returning an error when
        we try to get the issue types we try a second project
        """
        event = self.store_event(
            data={"message": "oh no", "timestamp": self.min_ago}, project_id=self.project.id
        )
        group = event.group
        assert group is not None
        assert self.installation.org_integration is not None
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.installation.org_integration.id,
            config={"project_issue_defaults": {str(group.project_id): {}}},
        )
        assert org_integration is not None
        self.installation.org_integration = org_integration
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/project",
            content_type="json",
            body="""[
                {"id": "10000", "key": "SAAH"},
                {"id": "10001", "key": "SAMP"},
                {"id": "10002", "key": "SAHM"}
            ]""",
        )
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/issue/createmeta/10000/issuetypes",
            content_type="json",
            status=400,
            body="",
        )

        fields = self.installation.get_create_issue_config(event.group, self.user)
        assert fields[0]["name"] == "project"
        assert fields[1]["name"] == "error"
        assert fields[1]["type"] == "blank"

    @patch("sentry.integrations.jira_server.client.JiraServerClient.get_issue_fields")
    def test_get_create_issue_config_with_default_project_deleted(self, mock_get_issue_fields):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group = event.group
        assert group is not None
        assert self.installation.org_integration is not None
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.installation.org_integration.id,
            config={"project_issue_defaults": {str(group.project_id): {"project": "10004"}}},
        )
        assert org_integration is not None
        self.installation.org_integration = org_integration

        with mock.patch.object(self.installation, "get_client", get_client):
            mock_get_issue_fields_return_value = orjson.loads(
                StubService.get_stub_json("jira", "issue_fields_response.json")
            )
            project_list_response = orjson.loads(
                StubService.get_stub_json("jira", "project_list_response.json")
            )
            side_effect_values = [
                mock_get_issue_fields_return_value for project in project_list_response
            ]
            # return None the first time issue_fields_response is called to mimic a deleted default project id (10004)
            # so that we drop into the code block where it iterates over available projects
            mock_get_issue_fields.side_effect = [None, *side_effect_values]

            fields = self.installation.get_create_issue_config(group, self.user)
            project_field = [field for field in fields if field["name"] == "project"][0]
            assert project_field == {
                "default": "10004",
                "choices": [("10000", "EX"), ("10001", "ABC")],
                "type": "select",
                "name": "project",
                "label": "Jira Project",
                "updatesForm": True,
            }

    def test_get_create_issue_config_with_label_default(self):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
            },
            project_id=self.project.id,
            default_event_type=EventType.DEFAULT,
        )
        group = event.group
        assert group is not None
        label_default = "hi"

        assert self.installation.org_integration is not None
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.installation.org_integration.id,
            config={"project_issue_defaults": {str(group.project_id): {"labels": label_default}}},
        )
        assert org_integration is not None
        self.installation.org_integration = org_integration

        with mock.patch.object(self.installation, "get_client", get_client):
            fields = self.installation.get_create_issue_config(group, self.user)
            label_field = [field for field in fields if field["name"] == "labels"][0]

            assert label_field == {
                "required": False,
                "type": "text",
                "name": "labels",
                "label": "Labels",
                "default": label_default,
            }

    @responses.activate
    def test_get_create_issue_config__no_projects(self):
        event = self.store_event(
            data={"message": "oh no", "timestamp": self.min_ago}, project_id=self.project.id
        )

        # Simulate no projects available.
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/project",
            content_type="json",
            body="{}",
        )
        with pytest.raises(IntegrationError):
            self.installation.get_create_issue_config(event.group, self.user)

    @responses.activate
    def test_get_create_issue_config__no_issue_config(self):
        event = self.store_event(
            data={"message": "oh no", "timestamp": self.min_ago}, project_id=self.project.id
        )

        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/project",
            content_type="json",
            body="""[
                {"id": "10000", "key": "SAMP"}
            ]""",
        )
        responses.add(
            responses.GET,
            f"https://jira.example.org/rest/api/2/issue/createmeta/{DEFAULT_PROJECT_ID}/issuetypes",
            body=StubService.get_stub_json("jira", "issue_types_response.json"),
            content_type="json",
        )
        # Fail to return metadata
        responses.add(
            responses.GET,
            f"https://jira.example.org/rest/api/2/issue/createmeta/{DEFAULT_PROJECT_ID}/issuetypes/{DEFAULT_ISSUE_TYPE_ID}",
            content_type="json",
            status=401,
            body="",
        )

        with pytest.raises(IntegrationError):
            self.installation.get_create_issue_config(event.group, self.user)

    def test_get_link_issue_config(self):
        group = self.create_group()

        assert self.installation.get_link_issue_config(group) == [
            {
                "name": "externalIssue",
                "label": "Issue",
                "default": "",
                "type": "select",
                "url": f"/extensions/jira-server/search/baz/{self.integration.id}/",
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": f"Linked Sentry Issue: [BAR-1|http://testserver/organizations/baz/issues/{group.id}/?referrer=jira_server]",
                "type": "textarea",
                "autosize": True,
                "maxRows": 10,
            },
        ]

    def test_create_issue_no_project(self):
        with mock.patch.object(StubJiraApiClient, "get_issue_fields") as mock_get_issue_fields:
            mock_issue_fields = StubService.get_stub_data("jira", "issue_fields_response.json")
            mock_issue_fields["values"] = list(
                filter(lambda x: x["fieldId"] != "project", mock_issue_fields["values"])
            )
            mock_get_issue_fields.return_value = mock_issue_fields
            with mock.patch.object(StubJiraApiClient, "create_issue") as mock_create_issue:
                mock_create_issue.return_value = {"key": "APP-123"}
                with mock.patch.object(self.installation, "get_client", get_client):
                    assert self.installation.create_issue(
                        {
                            "title": "example summary",
                            "description": "example bug report",
                            "issuetype": "1",
                            "project": "10000",
                        }
                    ) == {
                        "title": "example summary",
                        "description": "example bug report",
                        "key": "APP-123",
                    }
                    mock_create_issue.assert_called_once_with(
                        {
                            "description": "example bug report",
                            "issuetype": {"id": "1"},
                            "project": {"id": "10000"},
                            "summary": "example summary",
                        }
                    )

    def test_create_issue(self):
        with mock.patch.object(StubJiraApiClient, "create_issue") as mock_create_issue:
            mock_create_issue.return_value = {"key": "APP-123"}
            with mock.patch.object(self.installation, "get_client", get_client):
                assert self.installation.create_issue(
                    {
                        "title": "example summary",
                        "description": "example bug report",
                        "issuetype": "1",
                        "project": "10000",
                    }
                ) == {
                    "title": "example summary",
                    "description": "example bug report",
                    "key": "APP-123",
                }
                mock_create_issue.assert_called_once_with(
                    {
                        "description": "example bug report",
                        "issuetype": {"id": "1"},
                        "project": {"id": "10000"},
                        "summary": "example summary",
                    }
                )

    @responses.activate
    def test_create_issue_labels_and_option(self):
        responses.add(
            responses.GET,
            f"https://jira.example.org/rest/api/2/issue/createmeta/{DEFAULT_PROJECT_ID}/issuetypes/{DEFAULT_ISSUE_TYPE_ID}",
            body=StubService.get_stub_json("jira", "issue_fields_response.json"),
            content_type="json",
        )
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/issue/APP-123",
            body=StubService.get_stub_json("jira", "get_issue_response.json"),
            content_type="json",
        )

        def responder(request):
            body = orjson.loads(request.body)
            assert body["fields"]["labels"] == ["fuzzy", "bunnies"]
            assert body["fields"]["customfield_10200"] == {"value": "sad"}
            assert body["fields"]["customfield_10201"] == [
                {"value": "wow"},
                {"value": "devil"},
            ]
            return (200, {"content-type": "application/json"}, '{"key":"APP-123"}')

        responses.add_callback(
            responses.POST,
            "https://jira.example.org/rest/api/2/issue",
            callback=responder,
        )

        result = self.installation.create_issue(
            {
                "title": "example summary",
                "description": "example bug report",
                "issuetype": "10000",
                "project": "10000",
                "customfield_10200": "sad",
                "customfield_10201": ["wow", "devil"],
                "labels": "fuzzy , ,  bunnies",
            }
        )
        assert result["key"] == "APP-123"

    def test_outbound_issue_sync(self):
        integration, _ = self.create_provider_integration_for(
            organization=self.organization,
            user=self.user,
            provider="jira_server",
            name="Example Jira",
        )

        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=integration.id, key="SEN-5"
        )
        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            resolved_status="10101",
            unresolved_status="3",
            external_id="10100",
        )
        installation = integration.get_installation(self.organization.id)
        assert isinstance(installation, JiraServerIntegration)

        with mock.patch.object(StubJiraApiClient, "transition_issue") as mock_transition_issue:
            with mock.patch.object(installation, "get_client", get_client):
                # test unresolve -- 21 is "in progress" transition id
                installation.sync_status_outbound(external_issue, False, self.project.id)
                mock_transition_issue.assert_called_with("SEN-5", "21")

                # test resolve -- 31 is "done" transition id
                installation.sync_status_outbound(external_issue, True, self.project.id)
                mock_transition_issue.assert_called_with("SEN-5", "31")

    @responses.activate
    def test_sync_assignee_outbound_case_insensitive(self):
        user = serialize_rpc_user(self.create_user(email="bob@example.com"))
        issue_id = "APP-123"
        assign_issue_url = "https://jira.example.org/rest/api/2/issue/%s/assignee" % issue_id
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.installation.model.id,
            key=issue_id,
        )
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/user/assignable/search",
            json=[{"name": "Alive Tofu", "emailAddress": "Bob@example.com"}],
        )
        responses.add(responses.PUT, assign_issue_url, json={})
        self.installation.sync_assignee_outbound(external_issue, user)

        assert len(responses.calls) == 2

        # assert user above was successfully assigned
        assign_issue_response = responses.calls[1][1]
        assert assign_issue_url in assign_issue_response.url
        assert assign_issue_response.status_code == 200
        assert assign_issue_response.request.body == b'{"name": "Alive Tofu"}'

    @responses.activate
    def test_sync_assignee_outbound_no_emails_for_multiple_users(self):
        user = serialize_rpc_user(self.create_user(email="bob@example.com"))
        issue_id = "APP-123"
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.installation.model.id,
            key=issue_id,
        )
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/user/assignable/search",
            json=[
                {"accountId": "deadbeef123", "displayName": "Dead Beef", "name": "Beef"},
                {
                    "accountId": "alicetofu",
                    "displayName": "Alice Tofu",
                    "name": "Alice Tofu",
                },
            ],
        )

        with pytest.raises(IntegrationError) as e:
            self.installation.sync_assignee_outbound(external_issue, user)
        assert str(e.value) == "Failed to assign user to Jira Server issue"

        # No sync made as jira users don't have email addresses
        assert len(responses.calls) == 1

    @responses.activate
    def test_sync_assignee_outbound_user_email_empty(self):
        user = serialize_rpc_user(self.create_user(email=""))
        issue_id = "APP-123"
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.installation.model.id,
            key=issue_id,
        )
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/user/assignable/search",
            json=[
                {"accountId": "deadbeef123", "displayName": "Dead Beef", "name": "Beef"},
                {
                    "accountId": "alicetofu",
                    "displayName": "Alice Tofu",
                    "name": "Alice Tofu",
                },
            ],
        )

        with pytest.raises(AssertionError) as e:
            self.installation.sync_assignee_outbound(external_issue, user)
        assert str(e.value) == "Expected a valid user email, received falsy value"

        # No sync made as jira users don't have email addresses
        assert len(responses.calls) == 0

    @responses.activate
    @patch("sentry.integrations.jira_server.integration.JiraServerClient.assign_issue")
    def test_sync_assignee_outbound_no_email(self, mock_assign_issue):
        user = serialize_rpc_user(self.create_user(email="bob@example.com"))
        issue_id = "APP-123"
        fake_jira_user = {"accountId": "deadbeef123", "displayName": "Dead Beef", "name": "Beef"}
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.installation.model.id,
            key=issue_id,
        )
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/user/assignable/search",
            json=[fake_jira_user],
        )

        self.installation.sync_assignee_outbound(external_issue, user)

        mock_assign_issue.assert_called_with(
            issue_id,
            "Beef",
        )

    @responses.activate
    @patch("sentry.integrations.jira_server.integration.JiraServerClient.assign_issue")
    def test_sync_assignee_outbound_unauthorized(self, mock_assign_issue):
        mock_assign_issue.side_effect = ApiUnauthorized("Oops, unauthorized")
        user = serialize_rpc_user(self.create_user(email="bob@example.com"))
        issue_id = "APP-123"
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.installation.model.id,
            key=issue_id,
        )
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/user/assignable/search",
            json=[
                {
                    "accountId": "deadbeef123",
                    "displayName": "Dead Beef",
                    "username": "bob@example.com",
                }
            ],
        )
        with pytest.raises(IntegrationError) as exc_info:
            self.installation.sync_assignee_outbound(
                external_issue=external_issue, user=user, assign=True
            )

        assert str(exc_info.value) == "Insufficient permissions to assign user to Jira Server issue"

    @responses.activate
    @patch("sentry.integrations.jira_server.integration.JiraServerClient.assign_issue")
    def test_sync_assignee_outbound_api_error(self, mock_assign_issue):
        mock_assign_issue.side_effect = ApiError("API Error occurred")
        user = serialize_rpc_user(self.create_user(email="bob@example.com"))
        issue_id = "APP-123"
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.installation.model.id,
            key=issue_id,
        )
        responses.add(
            responses.GET,
            "https://jira.example.org/rest/api/2/user/assignable/search",
            json=[
                {
                    "accountId": "deadbeef123",
                    "displayName": "Dead Beef",
                    "username": "bob@example.com",
                }
            ],
        )
        with pytest.raises(IntegrationError) as exc_info:
            self.installation.sync_assignee_outbound(
                external_issue=external_issue, user=user, assign=True
            )

        assert str(exc_info.value) == "Failed to assign user to Jira Server issue"

    def test_get_config_data(self):
        integration = self.create_integration(
            organization=self.organization,
            provider="jira_server",
            external_id="jira:1",
            name="Example Jira",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_forward_assignment": True,
                    "sync_reverse_assignment": True,
                    "sync_status_reverse": True,
                    "sync_status_forward": True,
                }
            },
        )
        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_id="12345",
            unresolved_status="in_progress",
            resolved_status="done",
        )

        installation = integration.get_installation(self.organization.id)

        assert installation.get_config_data() == {
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
            "sync_status_reverse": True,
            "sync_status_forward": {"12345": {"on_resolve": "done", "on_unresolve": "in_progress"}},
            "issues_ignored_fields": "",
        }

    def test_get_config_data_issues_keys(self):
        integration, org_integration = self.create_provider_integration_for(
            organization=self.organization,
            user=self.user,
            provider="jira_server",
            name="Example Jira",
        )
        installation = integration.get_installation(self.organization.id)

        # If config has not be configured yet, uses empty string fallback
        assert "issues_ignored_fields" not in org_integration.config
        assert installation.get_config_data().get("issues_ignored_fields") == ""

        # List is serialized as comma-separated list
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration.config["issues_ignored_fields"] = ["hello world", "goodnight", "moon"]
            org_integration.save()
        installation = integration.get_installation(self.organization.id)
        assert (
            installation.get_config_data().get("issues_ignored_fields")
            == "hello world, goodnight, moon"
        )

    def test_create_comment(self):
        group_note = mock.Mock()
        comment = "hello world\nThis is a comment.\n\n\n    Glad it's quoted"
        group_note.data = {"text": comment}
        with mock.patch.object(StubJiraApiClient, "create_comment") as mock_create_comment:
            with mock.patch.object(self.installation, "get_client", get_client):
                self.installation.create_comment(1, self.user.id, group_note)
                assert (
                    mock_create_comment.call_args[0][1]
                    == "Sentry Admin wrote:\n\n{quote}%s{quote}" % comment
                )

    def test_update_comment(self):
        group_note = mock.Mock()
        comment = "hello world\nThis is a comment.\n\n\n    I've changed it"
        group_note.data = {"text": comment, "external_id": "123"}
        with mock.patch.object(StubJiraApiClient, "update_comment") as mock_update_comment:
            with mock.patch.object(self.installation, "get_client", get_client):
                self.installation.update_comment(1, self.user.id, group_note)
                assert mock_update_comment.call_args[0] == (
                    1,
                    "123",
                    "Sentry Admin wrote:\n\n{quote}%s{quote}" % comment,
                )


@control_silo_test
class JiraServerControlIntegrationTest(JiraServerIntegrationBaseTest):
    def test_update_organization_config_sync_keys(self):
        integration = self.create_provider_integration(provider="jira_server", name="Example Jira")
        integration.add_organization(self.organization, self.user)

        installation = integration.get_installation(self.organization.id)

        # test validation
        data = {
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
            "sync_status_reverse": True,
            "sync_status_forward": {10100: {"on_resolve": "", "on_unresolve": "3"}},
        }

        with pytest.raises(IntegrationError):
            installation.update_organization_config(data)

        data = {
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
            "sync_status_reverse": True,
            "sync_status_forward": {10100: {"on_resolve": "4", "on_unresolve": "3"}},
        }

        installation.update_organization_config(data)

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )

        assert org_integration.config == {
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
            "sync_status_reverse": True,
            "sync_status_forward": True,
        }

        assert IntegrationExternalProject.objects.filter(
            organization_integration_id=org_integration.id,
            resolved_status="4",
            unresolved_status="3",
        ).exists()

        # test update existing
        data = {
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
            "sync_status_reverse": True,
            "sync_status_forward": {10100: {"on_resolve": "4", "on_unresolve": "5"}},
        }

        installation.update_organization_config(data)

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )

        assert org_integration.config == {
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
            "sync_status_reverse": True,
            "sync_status_forward": True,
        }

        assert IntegrationExternalProject.objects.filter(
            organization_integration_id=org_integration.id,
            resolved_status="4",
            unresolved_status="5",
        ).exists()

        assert (
            IntegrationExternalProject.objects.filter(
                organization_integration_id=org_integration.id
            ).count()
            == 1
        )

        # test disable forward
        data = {
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
            "sync_status_reverse": True,
            "sync_status_forward": {},
        }

        installation.update_organization_config(data)

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )

        assert org_integration.config == {
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
            "sync_status_reverse": True,
            "sync_status_forward": False,
        }

        assert (
            IntegrationExternalProject.objects.filter(
                organization_integration_id=org_integration.id
            ).count()
            == 0
        )

    def test_update_organization_config_issues_keys(self):
        integration = self.create_provider_integration(provider="jira_server", name="Example Jira")
        integration.add_organization(self.organization, self.user)

        installation = integration.get_installation(self.organization.id)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
        assert "issues_ignored_fields" not in org_integration.config

        # Parses user-supplied CSV
        installation.update_organization_config(
            {"issues_ignored_fields": "\nhello world ,,\ngoodnight\nmoon , ,"}
        )
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
        assert org_integration.config.get("issues_ignored_fields") == [
            "hello world",
            "goodnight",
            "moon",
        ]

        # No-ops if updated value is not specified
        installation.update_organization_config({})
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
        assert org_integration.config.get("issues_ignored_fields") == [
            "hello world",
            "goodnight",
            "moon",
        ]


class JiraMigrationIntegrationTest(APITestCase):
    @cached_property
    def integration(self):
        integration = self.create_integration(
            organization=self.organization,
            external_id="jira_server:1",
            provider="jira_server",
            name="Jira Server",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        return integration

    def setUp(self):
        super().setUp()
        self.plugin = JiraPlugin()
        self.plugin.set_option("enabled", True, self.project)
        self.plugin.set_option("default_project", "SEN", self.project)
        self.plugin.set_option("instance_url", "https://example.atlassian.net", self.project)
        self.plugin.set_option("ignored_fields", "hellboy, meow", self.project)
        installation = self.integration.get_installation(self.organization.id)
        assert isinstance(installation, JiraServerIntegration)
        self.installation = installation
        self.login_as(self.user)

    def test_migrate_plugin(self):
        """Test that 2 projects with the Jira plugin enabled that each have an issue created
        from the plugin are migrated along with the ignored fields
        """
        project2 = self.create_project(
            name="hellbar", organization=self.organization, teams=[self.team]
        )
        plugin2 = JiraPlugin()
        plugin2.set_option("enabled", True, project2)
        plugin2.set_option("default_project", "BAR", project2)
        plugin2.set_option("instance_url", "https://example.atlassian.net", project2)

        group = self.create_group(message="Hello world", culprit="foo.bar")
        plugin_issue = GroupMeta.objects.create(
            key=f"{self.plugin.slug}:tid", group_id=group.id, value="SEN-1"
        )
        group2 = self.create_group(message="Hello world", culprit="foo.bar")
        plugin2_issue = GroupMeta.objects.create(
            key=f"{self.plugin.slug}:tid", group_id=group2.id, value="BAR-1"
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration = OrganizationIntegration.objects.get(
                integration_id=self.integration.id
            )
            with unguarded_write(router.db_for_write(OrganizationIntegration)):
                org_integration.config.update({"issues_ignored_fields": ["reporter", "test"]})
            org_integration.save()

        with self.tasks():
            self.installation.migrate_issues()

        assert ExternalIssue.objects.filter(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key=plugin_issue.value,
        ).exists()
        assert ExternalIssue.objects.filter(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key=plugin2_issue.value,
        ).exists()
        assert not GroupMeta.objects.filter(
            key=f"{self.plugin.slug}:tid", group_id=group.id, value="SEN-1"
        ).exists()
        assert not GroupMeta.objects.filter(
            key=f"{self.plugin.slug}:tid", group_id=group.id, value="BAR-1"
        ).exists()

        with assume_test_silo_mode(SiloMode.CONTROL):
            oi = OrganizationIntegration.objects.get(integration_id=self.integration.id)
            assert len(oi.config["issues_ignored_fields"]) == 4

        assert self.plugin.get_option("enabled", self.project) is False
        assert plugin2.get_option("enabled", project2) is False

    def test_instance_url_mismatch(self):
        """Test that if the plugin's instance URL does not match the integration's base URL, we don't migrate the issues"""
        self.plugin.set_option("instance_url", "https://hellboy.atlassian.net", self.project)
        group = self.create_group(message="Hello world", culprit="foo.bar")
        plugin_issue = GroupMeta.objects.create(
            key=f"{self.plugin.slug}:tid", group_id=group.id, value="SEN-1"
        )
        with self.tasks():
            self.installation.migrate_issues()

        assert not ExternalIssue.objects.filter(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key=plugin_issue.value,
        ).exists()
        assert GroupMeta.objects.filter(
            key=f"{self.plugin.slug}:tid", group_id=group.id, value="SEN-1"
        ).exists()

    def test_external_issue_already_exists(self):
        """Test that if an issue already exists during migration, we continue with no issue"""

        group = self.create_group(message="Hello world", culprit="foo.bar")
        GroupMeta.objects.create(key=f"{self.plugin.slug}:tid", group_id=group.id, value="SEN-1")
        group2 = self.create_group(message="Hello world", culprit="foo.bar")
        GroupMeta.objects.create(key=f"{self.plugin.slug}:tid", group_id=group2.id, value="BAR-1")
        integration_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            key="BAR-1",
        )
        GroupLink.objects.create(
            group_id=group2.id,
            project_id=self.project.id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=integration_issue.id,
            relationship=GroupLink.Relationship.references,
        )

        with self.tasks():
            self.installation.migrate_issues()
