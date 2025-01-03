from functools import cached_property
from unittest import mock
from unittest.mock import patch

import pytest
import responses
from django.test.utils import override_settings
from django.urls import reverse

from fixtures.integrations.jira.stub_client import StubJiraApiClient
from fixtures.integrations.stub_service import StubService
from sentry.integrations.jira.integration import JiraIntegrationProvider
from sentry.integrations.jira.views import SALT
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import integration_service
from sentry.models.grouplink import GroupLink
from sentry.models.groupmeta import GroupMeta
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.utils import json
from sentry.utils.signing import sign
from sentry_plugins.jira.plugin import JiraPlugin

pytestmark = [requires_snuba]


def get_client():
    return StubJiraApiClient()


class RegionJiraIntegrationTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1).isoformat()
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="jira:1",
            provider="jira",
            name="Jira Cloud",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user.name = "Sentry Admin"
            self.user.save()
        self.login_as(self.user)

    def test_create_comment(self):
        installation = self.integration.get_installation(self.organization.id)

        group_note = mock.Mock()
        comment = "hello world\nThis is a comment.\n\n\n    Glad it's quoted"
        group_note.data = {"text": comment}
        with mock.patch.object(StubJiraApiClient, "create_comment") as mock_create_comment:
            with mock.patch.object(installation, "get_client", get_client):
                installation.create_comment(1, self.user.id, group_note)
                assert (
                    mock_create_comment.call_args[0][1]
                    == "Sentry Admin wrote:\n\n{quote}%s{quote}" % comment
                )

    def test_update_comment(self):
        installation = self.integration.get_installation(self.organization.id)

        group_note = mock.Mock()
        comment = "hello world\nThis is a comment.\n\n\n    I've changed it"
        group_note.data = {"text": comment, "external_id": "123"}
        with mock.patch.object(StubJiraApiClient, "update_comment") as mock_update_comment:
            with mock.patch.object(installation, "get_client", get_client):
                installation.update_comment(1, self.user.id, group_note)
                assert mock_update_comment.call_args[0] == (
                    1,
                    "123",
                    "Sentry Admin wrote:\n\n{quote}%s{quote}" % comment,
                )

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

        installation = self.integration.get_installation(self.organization.id)
        search_url = reverse(
            "sentry-extensions-jira-search",
            args=[self.organization.slug, self.integration.id],
        )
        with mock.patch.object(installation, "get_client", get_client):
            assert installation.get_create_issue_config(group, self.user) == [
                {
                    "name": "project",
                    "default": "10000",
                    "updatesForm": True,
                    "choices": [("10000", "EX"), ("10001", "ABC")],
                    "label": "Jira Project",
                    "type": "select",
                },
                {
                    "default": "message",
                    "required": True,
                    "type": "string",
                    "name": "title",
                    "label": "Title",
                },
                {
                    "autosize": True,
                    "name": "description",
                    "default": (
                        "Sentry Issue: [%s|%s]\n\n{code}\n"
                        "Stacktrace (most recent call first):\n\n  "
                        'File "sentry/models/foo.py", line 29, in build_msg\n    '
                        "string_max_length=self.string_max_length)\n\nmessage\n{code}"
                    )
                    % (
                        group.qualified_short_id,
                        group.get_absolute_url(params={"referrer": "jira_integration"}),
                    ),
                    "label": "Description",
                    "maxRows": 10,
                    "type": "textarea",
                },
                {
                    "required": True,
                    "name": "issuetype",
                    "default": "1",
                    "updatesForm": True,
                    "choices": [("1", "Bug")],
                    "label": "Issue Type",
                    "type": "select",
                },
                {"label": "Team", "name": "customfield_10001", "required": False, "type": "text"},
                {
                    "name": "customfield_10200",
                    "default": "",
                    "required": False,
                    "choices": [("sad", "sad"), ("happy", "happy")],
                    "label": "Mood",
                    "type": "select",
                },
                {
                    "multiple": True,
                    "name": "customfield_10300",
                    "default": "",
                    "required": False,
                    "choices": [("Feature 1", "Feature 1"), ("Feature 2", "Feature 2")],
                    "label": "Feature",
                    "type": "select",
                },
                {
                    "name": "customfield_10400",
                    "url": search_url,
                    "choices": [],
                    "label": "Epic Link",
                    "required": False,
                    "type": "select",
                },
                {
                    "name": "customfield_10500",
                    "url": search_url,
                    "choices": [],
                    "label": "Sprint",
                    "required": False,
                    "type": "select",
                },
                {
                    "name": "labels",
                    "default": "",
                    "required": False,
                    "type": "text",
                    "label": "Labels",
                },
                {
                    "name": "parent",
                    "url": search_url,
                    "choices": [],
                    "label": "Parent",
                    "required": False,
                    "type": "select",
                },
                {
                    "name": "reporter",
                    "url": search_url,
                    "required": True,
                    "choices": [],
                    "label": "Reporter",
                    "type": "select",
                },
            ]

    def test_get_create_issue_config_customer_domain(self):
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

        installation = self.integration.get_installation(self.organization.id)
        with (
            self.feature("system:multi-region"),
            mock.patch.object(installation, "get_client", get_client),
        ):
            issue_config = installation.get_create_issue_config(group, self.user)
            assert f"{self.organization.slug}.testserver" in issue_config[2]["default"]

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
        installation = self.integration.get_installation(self.organization.id)

        # When persisted reporter matches a user JIRA knows about, a default is picked.
        account_id = StubService.get_stub_data("jira", "user.json")["accountId"]
        with assume_test_silo_mode_of(OrganizationIntegration):
            installation.store_issue_last_defaults(
                self.project, self.user, {"reporter": account_id}
            )

        with mock.patch.object(installation, "get_client", get_client):
            create_issue_config = installation.get_create_issue_config(group, self.user)
        reporter_field = [field for field in create_issue_config if field["name"] == "reporter"][0]
        assert reporter_field == {
            "name": "reporter",
            "url": reverse(
                "sentry-extensions-jira-search", args=[self.organization.slug, self.integration.id]
            ),
            "required": True,
            "choices": [("012345:00000000-1111-2222-3333-444444444444", "Saif Hakim")],
            "default": "012345:00000000-1111-2222-3333-444444444444",
            "label": "Reporter",
            "type": "select",
        }

        # When persisted reporter does not match a user JIRA knows about, field is left blank.
        with assume_test_silo_mode_of(OrganizationIntegration):
            installation.store_issue_last_defaults(
                self.project, self.user, {"reporter": "invalid-reporter-id"}
            )

        with mock.patch.object(installation, "get_client", get_client):
            create_issue_config = installation.get_create_issue_config(group, self.user)
        reporter_field = [field for field in create_issue_config if field["name"] == "reporter"][0]
        assert reporter_field == {
            "name": "reporter",
            "url": reverse(
                "sentry-extensions-jira-search", args=[self.organization.slug, self.integration.id]
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
        installation = self.integration.get_installation(self.organization.id)

        with mock.patch.object(installation, "get_client", get_client):
            # Initially all fields are present
            fields = installation.get_create_issue_config(group, self.user)
            field_names = [field["name"] for field in fields]
            assert field_names == [
                "project",
                "title",
                "description",
                "issuetype",
                "customfield_10001",
                "customfield_10200",
                "customfield_10300",
                "customfield_10400",
                "customfield_10500",
                "labels",
                "parent",
                "reporter",
            ]
            # After ignoring "customfield_10200", it no longer shows up
            with assume_test_silo_mode_of(OrganizationIntegration):
                installation.org_integration = integration_service.update_organization_integration(
                    org_integration_id=installation.org_integration.id,
                    config={"issues_ignored_fields": ["customfield_10200"]},
                )

            fields = installation.get_create_issue_config(group, self.user)
            field_names = [field["name"] for field in fields]
            assert field_names == [
                "project",
                "title",
                "description",
                "issuetype",
                "customfield_10001",
                "customfield_10300",
                "customfield_10400",
                "customfield_10500",
                "labels",
                "parent",
                "reporter",
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
        installation = self.integration.get_installation(self.organization.id)

        with assume_test_silo_mode_of(OrganizationIntegration):
            installation.org_integration = integration_service.update_organization_integration(
                org_integration_id=installation.org_integration.id,
                config={"project_issue_defaults": {str(group.project_id): {"project": "10001"}}},
            )

        with mock.patch.object(installation, "get_client", get_client):
            fields = installation.get_create_issue_config(
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
        installation = self.integration.get_installation(self.organization.id)

        with assume_test_silo_mode_of(OrganizationIntegration):
            installation.org_integration = integration_service.update_organization_integration(
                org_integration_id=installation.org_integration.id,
                config={"project_issue_defaults": {str(group.project_id): {"project": "10001"}}},
            )

        with mock.patch.object(installation, "get_client", get_client):
            fields = installation.get_create_issue_config(group, self.user)
            project_field = [field for field in fields if field["name"] == "project"][0]

            assert project_field == {
                "default": "10001",
                "choices": [("10000", "EX"), ("10001", "ABC")],
                "type": "select",
                "name": "project",
                "label": "Jira Project",
                "updatesForm": True,
            }

    @patch("sentry.integrations.jira.integration.JiraIntegration.fetch_issue_create_meta")
    def test_get_create_issue_config_with_default_project_deleted(
        self, mock_fetch_issue_create_meta
    ):
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
        installation = self.integration.get_installation(self.organization.id)

        with assume_test_silo_mode_of(OrganizationIntegration):
            installation.org_integration = integration_service.update_organization_integration(
                org_integration_id=installation.org_integration.id,
                config={"project_issue_defaults": {str(group.project_id): {"project": "10004"}}},
            )

        with mock.patch.object(installation, "get_client", get_client):
            mock_fetch_issue_create_meta_return_value = json.loads(
                StubService.get_stub_json("jira", "fetch_issue_create_meta.json")
            )
            project_list_response = json.loads(
                StubService.get_stub_json("jira", "project_list_response.json")
            )
            side_effect_values = [
                mock_fetch_issue_create_meta_return_value for project in project_list_response
            ]
            # return None the first time fetch_issue_create_meta is called to mimic a deleted default project id (10004)
            # so that we drop into the code block where it iterates over available projects
            mock_fetch_issue_create_meta.side_effect = [None, *side_effect_values]

            fields = installation.get_create_issue_config(group, self.user)
            project_field = [field for field in fields if field["name"] == "project"][0]

            assert project_field == {
                "default": "10001",
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

        installation = self.integration.get_installation(self.organization.id)
        with assume_test_silo_mode_of(OrganizationIntegration):
            installation.org_integration = integration_service.update_organization_integration(
                org_integration_id=installation.org_integration.id,
                config={
                    "project_issue_defaults": {str(group.project_id): {"labels": label_default}}
                },
            )

        with mock.patch.object(installation, "get_client", get_client):
            fields = installation.get_create_issue_config(group, self.user)
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

        installation = self.integration.get_installation(self.organization.id)

        # Simulate no projects available.
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            content_type="json",
            body="{}",
        )
        with pytest.raises(IntegrationError):
            installation.get_create_issue_config(event.group, self.user)

    @responses.activate
    def test_get_create_issue_config__no_issue_config(self):
        event = self.store_event(
            data={"message": "oh no", "timestamp": self.min_ago}, project_id=self.project.id
        )

        installation = self.integration.get_installation(self.organization.id)

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            content_type="json",
            body="""[
                {"id": "10000", "key": "SAMP"}
            ]""",
        )
        # Fail to return metadata
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            content_type="json",
            status=401,
            body="",
        )
        with pytest.raises(IntegrationError):
            installation.get_create_issue_config(event.group, self.user)

    def test_get_link_issue_config(self):
        group = self.create_group()

        installation = self.integration.get_installation(self.organization.id)

        assert installation.get_link_issue_config(group) == [
            {
                "name": "externalIssue",
                "label": "Issue",
                "default": "",
                "type": "select",
                "url": reverse(
                    "sentry-extensions-jira-search",
                    args=[self.organization.slug, self.integration.id],
                ),
            }
        ]

    def test_create_issue(self):
        installation = self.integration.get_installation(self.organization.id)

        with mock.patch.object(installation, "get_client", get_client):
            assert installation.create_issue(
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

    @responses.activate
    def test_create_issue_labels_and_option(self):
        installation = self.integration.get_installation(self.organization.id)

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            body=StubService.get_stub_json("jira", "createmeta_response.json"),
            content_type="json",
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/APP-123",
            body=StubService.get_stub_json("jira", "get_issue_response.json"),
            content_type="json",
        )

        def responder(request):
            body = json.loads(request.body)
            assert body["fields"]["labels"] == ["fuzzy", "bunnies"]
            assert body["fields"]["customfield_10200"] == {"value": "sad"}
            assert body["fields"]["customfield_10300"] == [
                {"value": "Feature 1"},
                {"value": "Feature 2"},
            ]
            return (200, {"content-type": "application/json"}, '{"key":"APP-123"}')

        responses.add_callback(
            responses.POST,
            "https://example.atlassian.net/rest/api/2/issue",
            callback=responder,
        )

        result = installation.create_issue(
            {
                "title": "example summary",
                "description": "example bug report",
                "issuetype": "1",
                "project": "10000",
                "customfield_10200": "sad",
                "customfield_10300": ["Feature 1", "Feature 2"],
                "labels": "fuzzy , ,  bunnies",
            }
        )
        assert result["key"] == "APP-123"

    def test_outbound_issue_sync(self):
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=self.integration.id, key="SEN-5"
        )

        with assume_test_silo_mode_of(IntegrationExternalProject):
            IntegrationExternalProject.objects.create(
                external_id="10100",
                organization_integration_id=OrganizationIntegration.objects.get(
                    organization_id=self.organization.id, integration_id=self.integration.id
                ).id,
                resolved_status="10101",
                unresolved_status="3",
            )

        installation = self.integration.get_installation(self.organization.id)

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
        installation = self.integration.get_installation(self.organization.id)
        assign_issue_url = "https://example.atlassian.net/rest/api/2/issue/%s/assignee" % issue_id

        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id, integration_id=installation.model.id, key=issue_id
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/user/assignable/search",
            json=[{"accountId": "deadbeef123", "emailAddress": "Bob@example.com"}],
        )
        responses.add(responses.PUT, assign_issue_url, json={})
        installation.sync_assignee_outbound(external_issue, user)

        assert len(responses.calls) == 2

        # assert user above was successfully assigned
        assign_issue_response = responses.calls[1][1]
        assert assign_issue_url in assign_issue_response.url
        assert assign_issue_response.status_code == 200
        assert assign_issue_response.request.body == b'{"accountId": "deadbeef123"}'

    @responses.activate
    def test_sync_assignee_outbound_no_email(self):
        user = serialize_rpc_user(self.create_user(email="bob@example.com"))
        issue_id = "APP-123"
        installation = self.integration.get_installation(self.organization.id)
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=installation.model.id,
            key=issue_id,
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/user/assignable/search",
            json=[{"accountId": "deadbeef123", "displayName": "Dead Beef"}],
        )
        installation.sync_assignee_outbound(external_issue, user)

        # No sync made as jira users don't have email addresses
        assert len(responses.calls) == 1

    @override_settings(JIRA_USE_EMAIL_SCOPE=True)
    @responses.activate
    def test_sync_assignee_outbound_use_email_api(self):
        user = serialize_rpc_user(self.create_user(email="bob@example.com"))
        issue_id = "APP-123"
        installation = self.integration.get_installation(self.organization.id)
        assign_issue_url = "https://example.atlassian.net/rest/api/2/issue/%s/assignee" % issue_id
        external_issue = ExternalIssue.objects.create(
            organization_id=self.organization.id,
            integration_id=installation.model.id,
            key=issue_id,
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/user/assignable/search",
            json=[{"accountId": "deadbeef123", "displayName": "Dead Beef", "emailAddress": ""}],
        )

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/3/user/email",
            json={"accountId": "deadbeef123", "email": "bob@example.com"},
        )
        responses.add(responses.PUT, assign_issue_url, json={})

        installation.sync_assignee_outbound(external_issue, user)

        # extra call to get email address
        assert len(responses.calls) == 3

        assign_issue_response = responses.calls[2][1]
        assert assign_issue_url in assign_issue_response.url
        assert assign_issue_response.status_code == 200
        assert assign_issue_response.request.body == b'{"accountId": "deadbeef123"}'


@control_silo_test
class JiraIntegrationTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.login_as(self.user)

    def test_update_organization_config_sync_keys(self):
        integration = self.create_provider_integration(provider="jira", name="Example Jira")
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
        integration = self.create_provider_integration(provider="jira", name="Example Jira")
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

    def test_get_config_data(self):
        integration = self.create_provider_integration(provider="jira", name="Example Jira")
        integration.add_organization(self.organization, self.user)

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )

        org_integration.config = {
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
            "sync_status_reverse": True,
            "sync_status_forward": True,
        }
        org_integration.save()

        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
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
        integration = self.create_provider_integration(provider="jira", name="Example Jira")
        integration.add_organization(self.organization, self.user)

        installation = integration.get_installation(self.organization.id)
        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )

        # If config has not be configured yet, uses empty string fallback
        assert "issues_ignored_fields" not in org_integration.config
        assert installation.get_config_data().get("issues_ignored_fields") == ""

        # List is serialized as comma-separated list
        org_integration.config["issues_ignored_fields"] = ["hello world", "goodnight", "moon"]
        org_integration.save()
        installation = integration.get_installation(self.organization.id)
        assert (
            installation.get_config_data().get("issues_ignored_fields")
            == "hello world, goodnight, moon"
        )


class JiraMigrationIntegrationTest(APITestCase):
    @cached_property
    def integration(self):
        integration = self.create_provider_integration(
            provider="jira",
            name="Jira Cloud",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        integration.add_organization(self.organization, self.user)
        return integration

    def setUp(self):
        super().setUp()
        self.plugin = JiraPlugin()
        self.plugin.set_option("enabled", True, self.project)
        self.plugin.set_option("default_project", "SEN", self.project)
        self.plugin.set_option("instance_url", "https://example.atlassian.net", self.project)
        self.plugin.set_option("ignored_fields", "hellboy, meow", self.project)
        with assume_test_silo_mode_of(Integration):
            self.installation = self.integration.get_installation(self.organization.id)
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
        with assume_test_silo_mode_of(OrganizationIntegration):
            org_integration = OrganizationIntegration.objects.get(
                integration_id=self.integration.id
            )
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

        with assume_test_silo_mode_of(OrganizationIntegration):
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


@control_silo_test
class JiraInstallationTest(IntegrationTestCase):
    provider = JiraIntegrationProvider

    def setUp(self):
        super().setUp()
        self.metadata = {
            "oauth_client_id": "oauth-client-id",
            "shared_secret": "a-super-secret-key-from-atlassian",
            "base_url": "https://example.atlassian.net",
            "domain_name": "example.atlassian.net",
        }
        self.integration = self.create_provider_integration(
            provider="jira",
            name="Jira Cloud",
            external_id="my-external-id",
            metadata=self.metadata,
        )

    def assert_setup_flow(self):
        self.login_as(self.user)
        signed_data = {"external_id": "my-external-id", "metadata": json.dumps(self.metadata)}
        params = {"signed_params": sign(salt=SALT, **signed_data)}
        resp = self.client.get(self.configure_path, params)
        assert resp.status_code == 302
        integration = Integration.objects.get(external_id="my-external-id")
        assert integration.metadata == self.metadata
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()

    def test_installation(self):
        self.assert_setup_flow()
