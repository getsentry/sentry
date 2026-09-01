from typing import Any
from unittest import mock
from unittest.mock import patch

import pytest
import responses
from django.test.utils import override_settings
from django.urls import reverse

from fixtures.integrations.jira.stub_client import StubJiraApiClient
from fixtures.integrations.stub_service import StubService
from sentry.integrations.jira.integration import (
    JiraIntegrationProvider,
    _build_project_mapping_audit_data,
    _ProjectStatusMapping,
)
from sentry.integrations.jira.views import SALT
from sentry.integrations.mixins.issues import IntegrationSyncTargetNotFound
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration import integration_service
from sentry.shared_integrations.exceptions import (
    ApiError,
    IntegrationConfigurationError,
    IntegrationError,
    IntegrationFormError,
)
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import EventType
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, assume_test_silo_mode_of, control_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.utils import json
from sentry.utils.signing import sign

pytestmark = [requires_snuba]
EXPLICIT_MAPPING_REMOVALS_FEATURE = "organizations:jira-explicit-mapping-removals"


def get_client():
    return StubJiraApiClient()


def test_build_project_mapping_audit_data() -> None:
    upserts = {
        external_id: _ProjectStatusMapping(
            on_resolve=f"resolve-{external_id}", on_unresolve=f"unresolve-{external_id}"
        )
        for external_id in ("1", "2", "3")
    }
    existing = {
        external_id: _ProjectStatusMapping(
            on_resolve=f"previous-resolve-{external_id}",
            on_unresolve=f"previous-unresolve-{external_id}",
        )
        for external_id in ("2", "3", "4", "5", "6")
    }

    assert _build_project_mapping_audit_data(
        additions=["1"],
        updates=["2", "3"],
        removals=["4", "5", "6"],
        upserts=upserts,
        existing=existing,
    ) == {
        "added_count": 1,
        "updated_count": 2,
        "removed_count": 3,
        "added_project_mappings": [
            {"external_id": "1", "on_resolve": "resolve-1", "on_unresolve": "unresolve-1"}
        ],
        "updated_project_mappings": [
            {
                "external_id": "2",
                "on_resolve": "resolve-2",
                "on_unresolve": "unresolve-2",
                "previous_on_resolve": "previous-resolve-2",
                "previous_on_unresolve": "previous-unresolve-2",
            },
            {
                "external_id": "3",
                "on_resolve": "resolve-3",
                "on_unresolve": "unresolve-3",
                "previous_on_resolve": "previous-resolve-3",
                "previous_on_unresolve": "previous-unresolve-3",
            },
        ],
        "removed_project_mappings": [
            {
                "external_id": "4",
                "on_resolve": "previous-resolve-4",
                "on_unresolve": "previous-unresolve-4",
            },
            {
                "external_id": "5",
                "on_resolve": "previous-resolve-5",
                "on_unresolve": "previous-unresolve-5",
            },
            {
                "external_id": "6",
                "on_resolve": "previous-resolve-6",
                "on_unresolve": "previous-unresolve-6",
            },
        ],
    }

    assert (
        _build_project_mapping_audit_data(
            additions=[], updates=[], removals=[], upserts={}, existing={}
        )
        is None
    )


class RegionJiraIntegrationTest(APITestCase):
    def setUp(self) -> None:
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

    def test_create_comment(self) -> None:
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

    def test_update_comment(self) -> None:
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

    def test_get_create_issue_config(self) -> None:
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
                    "choices": [("10000", "EX - Example"), ("10001", "ABC - Alphabetical")],
                    "label": "Jira Project",
                    "type": "select",
                    "url": search_url,
                    "required": True,
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

    @responses.activate
    def test_get_create_issue_config_with_none_issue(self) -> None:
        # Mock the paginated projects response
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={
                "values": [
                    {"id": "10000", "key": "PROJ1", "name": "Project 1"},
                    {"id": "10001", "key": "PROJ2", "name": "Project 2"},
                ],
                "total": 2,
            },
        )

        # Mock the create issue metadata endpoint
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            json={
                "projects": [
                    {
                        "id": "10000",
                        "key": "PROJ1",
                        "name": "Project 1",
                        "issuetypes": [
                            {
                                "description": "An error in the code",
                                "fields": {
                                    "issuetype": {
                                        "key": "issuetype",
                                        "name": "Issue Type",
                                        "required": True,
                                    }
                                },
                                "id": "bug1",
                                "name": "Bug",
                            }
                        ],
                    }
                ]
            },
        )
        # None, user, params=self.params
        installation = self.integration.get_installation(self.organization.id)
        fields = installation.get_create_issue_config(group=None, user=self.user)

        # Find the project field in the config
        project_field = next(field for field in fields if field["name"] == "project")

        # Verify the project field is configured correctly
        assert (
            project_field["url"]
            == f"/extensions/jira/search/{self.organization.slug}/{self.integration.id}/"
        )
        assert project_field["choices"] == [
            ("10000", "PROJ1 - Project 1"),
            ("10001", "PROJ2 - Project 2"),
        ]
        assert project_field["type"] == "select"

    @responses.activate
    def test_get_create_issue_config_paginated_projects(self) -> None:
        """Test that projects are fetched using pagination when the feature flag is enabled"""
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

        # Mock the paginated projects response
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={
                "values": [
                    {"id": "10000", "key": "PROJ1", "name": "Project 1"},
                    {"id": "10001", "key": "PROJ2", "name": "Project 2"},
                ],
                "total": 2,
            },
        )

        # Mock the create issue metadata endpoint
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            json={
                "projects": [
                    {
                        "id": "10000",
                        "key": "PROJ1",
                        "name": "Project 1",
                        "issuetypes": [
                            {
                                "description": "An error in the code",
                                "fields": {
                                    "issuetype": {
                                        "key": "issuetype",
                                        "name": "Issue Type",
                                        "required": True,
                                    }
                                },
                                "id": "bug1",
                                "name": "Bug",
                            }
                        ],
                    }
                ]
            },
        )

        installation = self.integration.get_installation(self.organization.id)
        fields = installation.get_create_issue_config(group, self.user)

        # Find the project field in the config
        project_field = next(field for field in fields if field["name"] == "project")

        # Verify the project field is configured correctly
        assert (
            project_field["url"]
            == f"/extensions/jira/search/{self.organization.slug}/{self.integration.id}/"
        )
        assert project_field["choices"] == [
            ("10000", "PROJ1 - Project 1"),
            ("10001", "PROJ2 - Project 2"),
        ]
        assert project_field["type"] == "select"

    def test_get_create_issue_config_customer_domain(self) -> None:
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

    def test_get_create_issue_config_with_persisted_reporter(self) -> None:
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

    def test_get_create_issue_config_with_ignored_fields(self) -> None:
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

    def test_get_create_issue_config_with_default_and_param(self) -> None:
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
                "choices": [("10000", "EX - Example"), ("10001", "ABC - Alphabetical")],
                "type": "select",
                "name": "project",
                "label": "Jira Project",
                "url": reverse(
                    "sentry-extensions-jira-search",
                    args=[self.organization.slug, self.integration.id],
                ),
                "updatesForm": True,
                "required": True,
            }

    def test_get_create_issue_config_with_default(self) -> None:
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
                "choices": [("10000", "EX - Example"), ("10001", "ABC - Alphabetical")],
                "type": "select",
                "name": "project",
                "label": "Jira Project",
                "url": reverse(
                    "sentry-extensions-jira-search",
                    args=[self.organization.slug, self.integration.id],
                ),
                "updatesForm": True,
                "required": True,
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
                "choices": [("10000", "EX - Example"), ("10001", "ABC - Alphabetical")],
                "type": "select",
                "name": "project",
                "label": "Jira Project",
                "url": reverse(
                    "sentry-extensions-jira-search",
                    args=[self.organization.slug, self.integration.id],
                ),
                "updatesForm": True,
                "required": True,
            }

    def test_get_create_issue_config_with_label_default(self) -> None:
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
    def test_get_create_issue_config__no_projects(self) -> None:
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
    def test_get_create_issue_config__no_issue_config(self) -> None:
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

    def test_get_link_issue_config(self) -> None:
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

    def test_create_issue(self) -> None:
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
    def test_create_issue_with_form_error(self) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            body=StubService.get_stub_json("jira", "createmeta_response.json"),
            content_type="json",
        )
        responses.add(
            responses.POST,
            "https://example.atlassian.net/rest/api/2/issue",
            status=400,
            body=json.dumps({"errors": {"issuetype": ["Issue type is required."]}}),
            content_type="json",
        )

        installation = self.integration.get_installation(self.organization.id)
        with pytest.raises(IntegrationFormError):
            installation.create_issue(
                {
                    "title": "example summary",
                    "description": "example bug report",
                    "issuetype": "1",
                    "project": "10000",
                }
            )

    @responses.activate
    def test_create_issue_with_configuration_error(self) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            body=StubService.get_stub_json("jira", "createmeta_response.json"),
            content_type="json",
        )
        responses.add(
            responses.POST,
            "https://example.atlassian.net/rest/api/2/issue",
            status=400,
            body=json.dumps({"error": "Jira had an oopsie"}),
            content_type="json",
        )
        installation = self.integration.get_installation(self.organization.id)
        with pytest.raises(IntegrationConfigurationError):
            installation.create_issue(
                {
                    "title": "example summary",
                    "description": "example bug report",
                    "issuetype": "1",
                    "project": "10000",
                }
            )

    @responses.activate
    def test_create_issue_product_unavailable_error(self) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            body=StubService.get_stub_json("jira", "createmeta_response.json"),
            content_type="json",
        )
        # Simulate Jira returning an HTML "Product Unavailable" error page
        responses.add(
            responses.POST,
            "https://example.atlassian.net/rest/api/2/issue",
            status=503,
            body='<!DOCTYPE html>\n<html lang="en">\n    <head>\n        <title>Atlassian Cloud Notifications - Product Unavailable</title>\n    </head>\n    <body>\n        <h1>Jira has been deactivated</h1>\n    </body>\n</html>',
            content_type="text/html",
        )
        installation = self.integration.get_installation(self.organization.id)
        with pytest.raises(
            IntegrationConfigurationError,
            match="Something went wrong while communicating with Jira",
        ):
            installation.create_issue(
                {
                    "title": "example summary",
                    "description": "example bug report",
                    "issuetype": "1",
                    "project": "10000",
                }
            )

    @responses.activate
    def test_create_issue_page_unavailable_error(self) -> None:
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/issue/createmeta",
            body=StubService.get_stub_json("jira", "createmeta_response.json"),
            content_type="json",
        )
        # Simulate Jira returning an HTML "Page Unavailable" error
        responses.add(
            responses.POST,
            "https://example.atlassian.net/rest/api/2/issue",
            status=503,
            body='<!DOCTYPE html>\n<html lang="en">\n    <head>\n        <title>Page Unavailable</title>\n    </head>\n    <body>\n        <h1>Page Unavailable</h1>\n    </body>\n</html>',
            content_type="text/html",
        )
        installation = self.integration.get_installation(self.organization.id)
        with pytest.raises(
            IntegrationConfigurationError,
            match="Something went wrong while communicating with Jira",
        ):
            installation.create_issue(
                {
                    "title": "example summary",
                    "description": "example bug report",
                    "issuetype": "1",
                    "project": "10000",
                }
            )

    @responses.activate
    def test_create_issue_labels_and_option(self) -> None:
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

    def test_outbound_issue_sync(self) -> None:
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
    def test_sync_assignee_outbound_case_insensitive(self) -> None:
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
    def test_sync_assignee_outbound_no_email(self) -> None:
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
        with pytest.raises(IntegrationSyncTargetNotFound):
            installation.sync_assignee_outbound(external_issue, user)

        # No sync made as jira users don't have email addresses
        assert len(responses.calls) == 1

    @override_settings(JIRA_USE_EMAIL_SCOPE=True)
    @responses.activate
    def test_sync_assignee_outbound_use_email_api(self) -> None:
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

    @responses.activate
    def test_sync_assignee_outbound_api_unauthorized(self) -> None:
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
            json=[{"accountId": "deadbeef123", "emailAddress": "bob@example.com"}],
        )

        responses.add(responses.PUT, assign_issue_url, status=401, json={})

        with pytest.raises(IntegrationConfigurationError) as excinfo:
            installation.sync_assignee_outbound(external_issue, user)

        assert str(excinfo.value) == "Insufficient permissions to assign user to the Jira issue."
        assert len(responses.calls) == 2

    @responses.activate
    def test_sync_assignee_outbound_api_error(self) -> None:
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
            json=[{"accountId": "deadbeef123", "emailAddress": "bob@example.com"}],
        )

        responses.add(responses.PUT, assign_issue_url, status=400, json={})

        with pytest.raises(IntegrationError) as excinfo:
            installation.sync_assignee_outbound(external_issue, user)

        assert str(excinfo.value) == "There was an error assigning the issue."
        assert len(responses.calls) == 2


@control_silo_test
class JiraIntegrationTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.min_ago = before_now(minutes=1)
        self.login_as(self.user)

    def test_update_organization_config_sync_keys(self) -> None:
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

        # Without explicit removals enabled, the payload is a complete replacement. An empty
        # payload removes every mapping and disables forward sync.
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

    def test_update_organization_config_issues_keys(self) -> None:
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

    @responses.activate
    def test_get_config_data(self) -> None:
        integration = self.create_provider_integration(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
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

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=[{"id": "12345", "name": "Example Project"}],
        )

        # Create a valid project mapping
        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_id="12345",
            unresolved_status="in_progress",
            resolved_status="done",
        )

        # Create a project mapping that is missing from the projects list response. It is
        # hidden from the config response, but the row itself is left alone.
        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_id="67890",
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

        # Building the response must not rewrite the stored config, which keeps a bool here.
        assert installation.org_integration is not None
        assert installation.org_integration.config["sync_status_forward"] is True

    def test_get_config_data_returns_mappings_when_jira_api_fails(self) -> None:
        integration = self.create_provider_integration(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
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

        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_id="12345",
            unresolved_status="in_progress",
            resolved_status="done",
        )

        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_id="67890",
            unresolved_status="todo",
            resolved_status="resolved",
        )

        installation = integration.get_installation(self.organization.id)

        with mock.patch.object(
            installation, "_filter_active_projects", side_effect=ApiError("Jira is down")
        ):
            config = installation.get_config_data()

        assert config == {
            "sync_comments": True,
            "sync_forward_assignment": True,
            "sync_reverse_assignment": True,
            "sync_status_reverse": True,
            "sync_status_forward": {
                "12345": {"on_resolve": "done", "on_unresolve": "in_progress"},
                "67890": {"on_resolve": "resolved", "on_unresolve": "todo"},
            },
            "issues_ignored_fields": "",
        }

    @responses.activate
    def test_get_config_data_filters_via_paginated_endpoint_with_flag(self) -> None:
        integration = self.create_provider_integration(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
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

        for external_id in ("12345", "67890"):
            self.create_integration_external_project(
                organization_id=self.organization.id,
                integration_id=integration.id,
                external_id=external_id,
                unresolved_status="in_progress",
                resolved_status="done",
            )

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={"values": [{"id": "12345", "name": "Active Project"}]},
        )

        installation = integration.get_installation(self.organization.id)

        with self.feature("organizations:jira-paginated-project-config"):
            config = installation.get_config_data()

        assert config["sync_status_forward"] == {
            "12345": {"on_resolve": "done", "on_unresolve": "in_progress"},
        }
        assert len(responses.calls) == 1
        assert "rest/api/2/project/search" in responses.calls[0].request.url
        assert "id=12345" in responses.calls[0].request.url
        assert "id=67890" in responses.calls[0].request.url

    def _mappings(self, org_integration_id: int) -> dict[str, tuple[str, str]]:
        return {
            iep.external_id: (iep.resolved_status, iep.unresolved_status)
            for iep in IntegrationExternalProject.objects.filter(
                organization_integration_id=org_integration_id
            )
        }

    def _jira_installation_with_mappings(self, *external_ids: str):
        integration = self.create_provider_integration(provider="jira", name="Example Jira")
        integration.add_organization(self.organization, self.user)
        for external_id in external_ids:
            self.create_integration_external_project(
                organization_id=self.organization.id,
                integration_id=integration.id,
                external_id=external_id,
                resolved_status="done",
                unresolved_status="in_progress",
            )

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=integration.id
        )
        return integration.get_installation(self.organization.id), org_integration

    def test_update_organization_config_replaces_omitted_mappings_without_feature(self) -> None:
        installation, org_integration = self._jira_installation_with_mappings("1", "2")

        with patch("sentry.integrations.jira.integration.logger") as mock_logger:
            audit_data = installation.update_organization_config(
                {
                    "sync_status_forward": {
                        "1": {"on_resolve": "done", "on_unresolve": "in_progress"}
                    }
                }
            )

        assert self._mappings(org_integration.id) == {"1": ("done", "in_progress")}
        mock_logger.info.assert_not_called()
        assert audit_data == {
            "sync_status_forward": {
                "added_count": 0,
                "updated_count": 0,
                "removed_count": 1,
                "added_project_mappings": [],
                "updated_project_mappings": [],
                "removed_project_mappings": [
                    {"external_id": "2", "on_resolve": "done", "on_unresolve": "in_progress"}
                ],
            }
        }

    def test_update_organization_config_rejects_explicit_removal_without_feature(self) -> None:
        installation, org_integration = self._jira_installation_with_mappings("1")

        with pytest.raises(IntegrationError):
            installation.update_organization_config({"sync_status_forward": {"1": None}})

        assert self._mappings(org_integration.id) == {"1": ("done", "in_progress")}

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_organization_config_only_touches_changed_mappings(self) -> None:
        """
        A mapping the payload doesn't mention is left alone -- absence is not a delete.

        Untouched rows also keep their row rather than being deleted and recreated.
        """
        installation, org_integration = self._jira_installation_with_mappings("1", "2", "3")
        unchanged_row_id = IntegrationExternalProject.objects.get(
            organization_integration_id=org_integration.id, external_id="1"
        ).id

        audit_data = installation.update_organization_config(
            {
                "sync_status_forward": {
                    # unchanged
                    "1": {"on_resolve": "done", "on_unresolve": "in_progress"},
                    # status changed
                    "2": {"on_resolve": "closed", "on_unresolve": "open"},
                    # "3" omitted -> untouched
                    # new
                    "4": {"on_resolve": "shipped", "on_unresolve": "todo"},
                }
            }
        )

        assert self._mappings(org_integration.id) == {
            "1": ("done", "in_progress"),
            "2": ("closed", "open"),
            "3": ("done", "in_progress"),
            "4": ("shipped", "todo"),
        }

        # An untouched mapping keeps its row instead of being deleted and recreated.
        assert (
            IntegrationExternalProject.objects.get(
                organization_integration_id=org_integration.id, external_id="1"
            ).id
            == unchanged_row_id
        )

        # "3" was omitted, so it is absent from the audit entry -- nothing happened to it.
        assert audit_data == {
            "sync_status_forward": {
                "added_count": 1,
                "updated_count": 1,
                "removed_count": 0,
                "added_project_mappings": [
                    {"external_id": "4", "on_resolve": "shipped", "on_unresolve": "todo"}
                ],
                "updated_project_mappings": [
                    {
                        "external_id": "2",
                        "on_resolve": "closed",
                        "on_unresolve": "open",
                        "previous_on_resolve": "done",
                        "previous_on_unresolve": "in_progress",
                    }
                ],
                "removed_project_mappings": [],
            }
        }

        # Removing "3" now takes an explicit removal.
        audit_data = installation.update_organization_config({"sync_status_forward": {"3": None}})

        assert self._mappings(org_integration.id) == {
            "1": ("done", "in_progress"),
            "2": ("closed", "open"),
            "4": ("shipped", "todo"),
        }
        assert audit_data is not None
        assert audit_data["sync_status_forward"]["removed_project_mappings"] == [
            {"external_id": "3", "on_resolve": "done", "on_unresolve": "in_progress"}
        ]

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_organization_config_removes_only_explicit_removals(self) -> None:
        """One explicit removal removes exactly one mapping and records its prior statuses."""
        installation, org_integration = self._jira_installation_with_mappings("1", "2", "3")

        audit_data = installation.update_organization_config({"sync_status_forward": {"2": None}})

        assert self._mappings(org_integration.id) == {
            "1": ("done", "in_progress"),
            "3": ("done", "in_progress"),
        }
        assert audit_data == {
            "sync_status_forward": {
                "added_count": 0,
                "updated_count": 0,
                "removed_count": 1,
                "added_project_mappings": [],
                "updated_project_mappings": [],
                "removed_project_mappings": [
                    {"external_id": "2", "on_resolve": "done", "on_unresolve": "in_progress"}
                ],
            }
        }
        assert installation.org_integration is not None
        assert installation.org_integration.config["sync_status_forward"] is True

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_organization_config_empty_payload_leaves_mappings_alone(self) -> None:
        """
        The payload that caused the original incident -- a subset of the stored mappings, in
        the limit case an empty one. It must not delete anything, and must not flip the bool.
        """
        installation, org_integration = self._jira_installation_with_mappings("1", "2")

        # Nothing changed, so there is nothing to audit. The omission is recorded by the
        # metric and log instead.
        assert installation.update_organization_config({"sync_status_forward": {}}) is None

        assert self._mappings(org_integration.id) == {
            "1": ("done", "in_progress"),
            "2": ("done", "in_progress"),
        }
        assert installation.org_integration is not None
        assert installation.org_integration.config["sync_status_forward"] is True

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_organization_config_empty_payload_with_no_mappings(self) -> None:
        """With nothing stored, an empty payload leaves the derived bool off."""
        installation, org_integration = self._jira_installation_with_mappings()

        assert installation.update_organization_config({"sync_status_forward": {}}) is None

        assert installation.org_integration is not None
        assert installation.org_integration.config["sync_status_forward"] is False

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_organization_config_upsert_only_payload_keeps_sync_enabled(self) -> None:
        """
        The config bool is derived from the surviving rows, not from the payload.

        Deriving it from the payload would let a single-row upsert disable outbound sync for
        every mapping it omitted -- a quieter replay of the original incident.
        """
        installation, org_integration = self._jira_installation_with_mappings("1", "2")

        installation.update_organization_config(
            {"sync_status_forward": {"3": {"on_resolve": "shipped", "on_unresolve": "todo"}}}
        )

        assert set(self._mappings(org_integration.id)) == {"1", "2", "3"}
        assert installation.org_integration is not None
        assert installation.org_integration.config["sync_status_forward"] is True

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_organization_config_ignores_removal_for_unknown_mapping(self) -> None:
        """
        The settings form produces a stale removal by deleting a row twice before the
        refetch lands, so an unknown id is a silent no-op rather than an error.
        """
        installation, org_integration = self._jira_installation_with_mappings("1")

        assert (
            installation.update_organization_config(
                {
                    "sync_status_forward": {
                        "1": {"on_resolve": "done", "on_unresolve": "in_progress"},
                        "999": None,
                    }
                }
            )
            is None
        )

        assert self._mappings(org_integration.id) == {"1": ("done", "in_progress")}

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_organization_config_logs_omitted_mappings(self) -> None:
        """
        A payload that omits stored mappings leaves no audit entry, so the log is the only
        record that a caller still expects absence to delete.
        """
        installation, _ = self._jira_installation_with_mappings("1", "2")

        with patch("sentry.integrations.jira.integration.logger") as mock_logger:
            installation.update_organization_config(
                {"sync_status_forward": {"3": {"on_resolve": "shipped", "on_unresolve": "todo"}}}
            )

        mock_logger.info.assert_called_once_with(
            "jira.sync_status_forward.omits_existing_mappings",
            extra={
                "organization_id": self.organization.id,
                "integration_id": installation.model.id,
                "omitted_count": 2,
                "upsert_count": 1,
                "removal_count": 0,
            },
        )

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_organization_config_does_not_log_a_complete_payload(self) -> None:
        installation, _ = self._jira_installation_with_mappings("1")

        with patch("sentry.integrations.jira.integration.logger") as mock_logger:
            installation.update_organization_config(
                {"sync_status_forward": {"1": None, "999": None}}
            )

        mock_logger.info.assert_not_called()

    def test_update_organization_config_audits_a_status_only_change(self) -> None:
        """
        Overwriting an existing mapping's statuses is audited too.

        Nothing is added or removed in this case, but the prior statuses are gone from the
        database -- so they have to be recorded or the change is unrecoverable.
        """
        integration = self.create_provider_integration(provider="jira", name="Example Jira")
        integration.add_organization(self.organization, self.user)
        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_id="1",
            resolved_status="done",
            unresolved_status="in_progress",
        )

        installation = integration.get_installation(self.organization.id)
        audit_data = installation.update_organization_config(
            {"sync_status_forward": {"1": {"on_resolve": "closed", "on_unresolve": "open"}}}
        )

        assert audit_data == {
            "sync_status_forward": {
                "added_count": 0,
                "updated_count": 1,
                "removed_count": 0,
                "added_project_mappings": [],
                "updated_project_mappings": [
                    {
                        "external_id": "1",
                        "on_resolve": "closed",
                        "on_unresolve": "open",
                        "previous_on_resolve": "done",
                        "previous_on_unresolve": "in_progress",
                    }
                ],
                "removed_project_mappings": [],
            }
        }

    def test_update_organization_config_returns_no_audit_data_when_unchanged(self) -> None:
        integration = self.create_provider_integration(provider="jira", name="Example Jira")
        integration.add_organization(self.organization, self.user)
        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_id="1",
            resolved_status="done",
            unresolved_status="in_progress",
        )

        installation = integration.get_installation(self.organization.id)
        assert (
            installation.update_organization_config(
                {
                    "sync_status_forward": {
                        "1": {"on_resolve": "done", "on_unresolve": "in_progress"}
                    }
                }
            )
            is None
        )

    def test_update_organization_config_rejects_incomplete_mappings(self) -> None:
        """
        An incomplete mapping is rejected before any row is touched.

        `{}` in particular is an unfilled row in the settings form, so it has to keep raising
        rather than being read as a delete -- only `None` deletes.
        """
        installation, org_integration = self._jira_installation_with_mappings("1")

        payload: dict[str, Any]
        for payload in (
            {"2": {}},
            {"2": {"on_resolve": "done"}},
            {"2": {"on_resolve": "done", "on_unresolve": ""}},
            {"2": {"on_resolve": "", "on_unresolve": "open"}},
        ):
            with pytest.raises(IntegrationError):
                installation.update_organization_config({"sync_status_forward": payload})

        assert self._mappings(org_integration.id) == {"1": ("done", "in_progress")}

    def test_update_organization_config_rejects_malformed_mapping_payloads(self) -> None:
        """
        These all used to reach `.items()` or `.get()` and surface as an `AttributeError`,
        which the endpoint doesn't catch -- so a malformed payload was a 500, not a 400.

        `False` and `""` in particular must raise rather than being read as a delete.
        """
        installation, org_integration = self._jira_installation_with_mappings("1")

        payload: Any
        for payload in (
            # The stored value of this key is a bool, so a caller round-tripping the raw
            # config lands here.
            True,
            False,
            "sync_status_forward",
            ["1"],
            5,
            # Row values that aren't objects.
            {"1": "done"},
            {"1": []},
            {"1": 5},
            {"1": False},
            {"1": ""},
            # Blank project ids.
            {"": {"on_resolve": "done", "on_unresolve": "open"}},
            {"   ": None},
            # Two keys that collide once normalized -- ambiguous, and would let one payload
            # both upsert and remove the same mapping.
            {10100: {"on_resolve": "done", "on_unresolve": "open"}, "10100": None},
        ):
            with pytest.raises(IntegrationError):
                installation.update_organization_config({"sync_status_forward": payload})

        assert self._mappings(org_integration.id) == {"1": ("done", "in_progress")}

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_organization_config_mapping_write_is_atomic(self) -> None:
        """A failure part-way through must not leave the mappings half-written."""
        installation, org_integration = self._jira_installation_with_mappings("1", "2")

        # The explicitly removed row is deleted before anything is written, so a failing
        # insert has to bring it back.
        with patch.object(
            IntegrationExternalProject.objects,
            "bulk_create",
            side_effect=OSError("boom"),
        ):
            with pytest.raises(OSError):
                installation.update_organization_config(
                    {
                        "sync_status_forward": {
                            "1": None,
                            "3": {"on_resolve": "closed", "on_unresolve": "open"},
                        }
                    }
                )

        assert self._mappings(org_integration.id) == {
            "1": ("done", "in_progress"),
            "2": ("done", "in_progress"),
        }

        # Same boundary, reached through the update path instead.
        with patch.object(
            IntegrationExternalProject.objects,
            "bulk_update",
            side_effect=OSError("boom"),
        ):
            with pytest.raises(OSError):
                installation.update_organization_config(
                    {
                        "sync_status_forward": {
                            "1": None,
                            "2": {"on_resolve": "closed", "on_unresolve": "open"},
                        }
                    }
                )

        assert self._mappings(org_integration.id) == {
            "1": ("done", "in_progress"),
            "2": ("done", "in_progress"),
        }

    @responses.activate
    def test_get_config_data_issue_keys(self) -> None:
        integration = self.create_provider_integration(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        integration.add_organization(self.organization, self.user)

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=[{"id": "12345", "name": "Example Project"}],
        )

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

    @responses.activate
    def test_get_organization_config_uses_projects_list_without_flag(self) -> None:
        integration = self.create_provider_integration(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        integration.add_organization(self.organization, self.user)

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=[{"id": "10000", "name": "Project A"}],
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/statuses/search",
            json={"values": []},
        )

        installation = integration.get_installation(self.organization.id)
        config = installation.get_organization_config()

        assert config[0]["addDropdown"]["items"] == [
            {"value": "10000", "label": "Project A"},
        ]
        assert any(
            "rest/api/2/project" in call.request.url and "search" not in call.request.url
            for call in responses.calls
        )

    @responses.activate
    def test_get_organization_config_uses_paginated_endpoint_with_flag(self) -> None:
        integration = self.create_provider_integration(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        integration.add_organization(self.organization, self.user)

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={
                "values": [
                    {"id": "10000", "name": "Project A"},
                    {"id": "10001", "name": "Project B"},
                ],
                "maxResults": 50,
                "total": 2,
            },
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/statuses/search",
            json={"values": []},
        )

        installation = integration.get_installation(self.organization.id)
        with self.feature("organizations:jira-paginated-project-config"):
            config = installation.get_organization_config()

        assert config[0]["addDropdown"]["items"] == [
            {"value": "10000", "label": "Project A"},
            {"value": "10001", "label": "Project B"},
        ]
        assert any("rest/api/2/project/search" in call.request.url for call in responses.calls)

    @responses.activate
    def test_get_organization_config_paginated_api_error_disables_config(self) -> None:
        integration = self.create_provider_integration(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        integration.add_organization(self.organization, self.user)

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={"errorMessages": ["Something went wrong"]},
            status=500,
        )

        installation = integration.get_installation(self.organization.id)
        with self.feature("organizations:jira-paginated-project-config"):
            config = installation.get_organization_config()

        assert config[0]["disabled"] is True
        assert "Unable to communicate" in config[0]["disabledReason"]

    def _create_paginated_jira_integration(self) -> Integration:
        integration = self.create_provider_integration(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        integration.add_organization(self.organization, self.user)
        return integration

    @responses.activate
    def test_get_organization_config_includes_configured_project_beyond_first_page(self) -> None:
        integration = self._create_paginated_jira_integration()
        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_id="99999",
            unresolved_status="in_progress",
            resolved_status="done",
        )

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={
                "values": [
                    {"id": "10000", "name": "Project A"},
                    {"id": "10001", "name": "Project B"},
                ],
                "maxResults": 50,
                "total": 2,
            },
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={"values": [{"id": "99999", "name": "Configured Project"}]},
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/statuses/search",
            json={"values": []},
        )

        installation = integration.get_installation(self.organization.id)
        with self.feature("organizations:jira-paginated-project-config"):
            config = installation.get_organization_config()

        assert config[0]["addDropdown"]["items"] == [
            {"value": "10000", "label": "Project A"},
            {"value": "10001", "label": "Project B"},
            {"value": "99999", "label": "Configured Project"},
        ]
        project_search_calls = [
            call for call in responses.calls if "project/search" in call.request.url
        ]
        assert len(project_search_calls) == 2
        assert "maxResults=50" in project_search_calls[0].request.url
        assert "id=99999" not in project_search_calls[0].request.url
        assert "id=99999" in project_search_calls[1].request.url

    @responses.activate
    def test_get_organization_config_no_configured_projects_skips_supplemental_fetch(self) -> None:
        integration = self._create_paginated_jira_integration()

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={
                "values": [
                    {"id": "10000", "name": "Project A"},
                    {"id": "10001", "name": "Project B"},
                ],
                "maxResults": 50,
                "total": 2,
            },
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/statuses/search",
            json={"values": []},
        )

        installation = integration.get_installation(self.organization.id)
        with self.feature("organizations:jira-paginated-project-config"):
            config = installation.get_organization_config()

        assert config[0]["addDropdown"]["items"] == [
            {"value": "10000", "label": "Project A"},
            {"value": "10001", "label": "Project B"},
        ]
        project_search_calls = [
            call for call in responses.calls if "project/search" in call.request.url
        ]
        assert len(project_search_calls) == 1
        assert "id=" not in project_search_calls[0].request.url

    @responses.activate
    def test_get_organization_config_configured_project_in_first_page_not_duplicated(self) -> None:
        integration = self._create_paginated_jira_integration()
        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_id="10000",
            unresolved_status="in_progress",
            resolved_status="done",
        )

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={
                "values": [
                    {"id": "10000", "name": "Project A"},
                    {"id": "10001", "name": "Project B"},
                ],
                "maxResults": 50,
                "total": 2,
            },
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/statuses/search",
            json={"values": []},
        )

        installation = integration.get_installation(self.organization.id)
        with self.feature("organizations:jira-paginated-project-config"):
            config = installation.get_organization_config()

        assert config[0]["addDropdown"]["items"] == [
            {"value": "10000", "label": "Project A"},
            {"value": "10001", "label": "Project B"},
        ]
        project_search_calls = [
            call for call in responses.calls if "project/search" in call.request.url
        ]
        assert len(project_search_calls) == 1
        assert "id=" not in project_search_calls[0].request.url

    @responses.activate
    def test_get_organization_config_supplemental_fetch_failure_degrades_gracefully(self) -> None:
        integration = self._create_paginated_jira_integration()
        self.create_integration_external_project(
            organization_id=self.organization.id,
            integration_id=integration.id,
            external_id="99999",
            unresolved_status="in_progress",
            resolved_status="done",
        )

        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={
                "values": [
                    {"id": "10000", "name": "Project A"},
                    {"id": "10001", "name": "Project B"},
                ],
                "maxResults": 50,
                "total": 2,
            },
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project/search",
            json={"errorMessages": ["Something went wrong"]},
            status=500,
        )
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/statuses/search",
            json={"values": []},
        )

        installation = integration.get_installation(self.organization.id)
        with self.feature("organizations:jira-paginated-project-config"):
            config = installation.get_organization_config()

        # The supplemental (name-resolving) fetch failing should not disable the whole config.
        assert config[0].get("disabled") is not True
        assert config[0]["addDropdown"]["items"] == [
            {"value": "10000", "label": "Project A"},
            {"value": "10001", "label": "Project B"},
        ]
        project_search_calls = [
            call for call in responses.calls if "project/search" in call.request.url
        ]
        assert len(project_search_calls) == 2
        assert "id=99999" in project_search_calls[1].request.url

    def _setup_jira_with_status_responses(
        self,
        projects: list[dict[str, str]] | None = None,
        statuses: list[dict[str, str]] | None = None,
    ) -> tuple[Integration, Any]:
        integration = self.create_provider_integration(
            provider="jira",
            name="Example Jira",
            metadata={
                "oauth_client_id": "oauth-client-id",
                "shared_secret": "a-super-secret-key-from-atlassian",
                "base_url": "https://example.atlassian.net",
                "domain_name": "example.atlassian.net",
            },
        )
        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        if projects is None:
            projects = [{"id": "10000", "name": "Project A"}]
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=projects,
        )

        if statuses is not None:
            responses.add(
                responses.GET,
                "https://example.atlassian.net/rest/api/2/statuses/search",
                json={"values": statuses},
            )

        return integration, installation

    @responses.activate
    @with_feature("organizations:jira-lazy-status-sync")
    def test_get_organization_config_lazy_status_with_configured_projects(self) -> None:
        integration, installation = self._setup_jira_with_status_responses(
            projects=[
                {"id": "10000", "name": "Project A"},
                {"id": "10001", "name": "Project B"},
            ],
            statuses=[
                {"id": "1", "name": "Open"},
                {"id": "6", "name": "Closed"},
            ],
        )

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration=integration
        )
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id="10000",
            name="Project A",
            resolved_status="6",
            unresolved_status="1",
        )

        config = installation.get_organization_config()

        assert config[0]["perItemMapping"] is True
        assert "statusUrl" in config[0]
        assert config[0]["mappedSelectors"]["10000"] == {
            "on_resolve": {"choices": [("1", "Open"), ("6", "Closed")]},
            "on_unresolve": {"choices": [("1", "Open"), ("6", "Closed")]},
        }
        assert "10001" not in config[0]["mappedSelectors"]

    @responses.activate
    @with_feature("organizations:jira-lazy-status-sync")
    def test_get_organization_config_lazy_status_no_configured_projects(self) -> None:
        _integration, installation = self._setup_jira_with_status_responses()

        config = installation.get_organization_config()

        assert config[0]["perItemMapping"] is True
        assert "statusUrl" in config[0]
        assert config[0]["mappedSelectors"] == {}

    @responses.activate
    def test_get_organization_config_flag_off_uses_existing_behavior(self) -> None:
        _integration, installation = self._setup_jira_with_status_responses(
            statuses=[
                {"id": "1", "name": "Open"},
                {"id": "6", "name": "Closed"},
            ],
        )

        config = installation.get_organization_config()

        assert config[0]["perItemMapping"] is True
        assert "statusUrl" not in config[0]
        assert config[0]["mappedSelectors"]["10000"] == {
            "on_resolve": {"choices": [("1", "Open"), ("6", "Closed")]},
            "on_unresolve": {"choices": [("1", "Open"), ("6", "Closed")]},
        }

    def test_error_fields_from_json_issue_not_found(self) -> None:
        integration = self.create_provider_integration(provider="jira", name="Example Jira")
        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        # Matches the exact Jira error message with trailing period
        msg_with_period = "Issue does not exist or you do not have permission to see it."
        result = installation.error_fields_from_json(
            {"errorMessages": [msg_with_period], "errors": {}}
        )
        assert result == {"Issue": [msg_with_period]}

        # Also matches without trailing period
        msg_no_period = "Issue does not exist or you do not have permission to see it"
        result = installation.error_fields_from_json(
            {"errorMessages": [msg_no_period], "errors": {}}
        )
        assert result == {"Issue": [msg_no_period]}

        # Also matches with different casing
        msg_lowercase = "issue does not exist or you do not have permission to see it."
        result = installation.error_fields_from_json(
            {"errorMessages": [msg_lowercase], "errors": {}}
        )
        assert result == {"Issue": [msg_lowercase]}

    def test_raise_error_with_issue_not_found_json(self) -> None:
        from sentry.shared_integrations.exceptions import ApiError

        integration = self.create_provider_integration(provider="jira", name="Example Jira")
        integration.add_organization(self.organization, self.user)
        installation = integration.get_installation(self.organization.id)

        msg = "Issue does not exist or you do not have permission to see it."
        exc = ApiError(json.dumps({"errorMessages": [msg], "errors": {}}), code=404)

        with pytest.raises(IntegrationFormError) as exc_info:
            installation.raise_error(exc)

        assert exc_info.value.field_errors == {"Issue": [msg]}


@control_silo_test
class JiraApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"
    provider = JiraIntegrationProvider

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.external_id = "my-external-id"
        self.metadata = {
            "oauth_client_id": "oauth-client-id",
            "shared_secret": "a-super-secret-key-from-atlassian",
            "base_url": "https://example.atlassian.net",
            "domain_name": "example.atlassian.net",
        }

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self, initial_data: dict[str, Any] | None = None) -> Any:
        payload: dict[str, Any] = {"action": "initialize", "provider": self.provider.key}
        if initial_data is not None:
            payload["initialData"] = initial_data
        return self.client.post(self._get_pipeline_url(), data=payload, format="json")

    def _advance_step(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    def _signed_params(self) -> str:
        return sign(salt=SALT, external_id=self.external_id, metadata=json.dumps(self.metadata))

    def test_initialize_returns_confirmation_data(self) -> None:
        resp = self._initialize_pipeline(initial_data={"signedParams": self._signed_params()})
        assert resp.status_code == 200
        assert resp.data["step"] == "jira_confirm_install"
        data = resp.data["data"]
        assert data["baseUrl"] == "https://example.atlassian.net"
        assert data["organization"] == self.organization.name
        assert "state" in data
        # Confirmation step does not auto-advance.
        assert "appDirectoryInstall" not in data
        assert not Integration.objects.filter(provider=self.provider.key).exists()

    def test_initialize_expired_signature(self) -> None:
        with patch("sentry.integrations.jira.integration.INSTALL_EXPIRATION_TIME", -1):
            resp = self._initialize_pipeline(initial_data={"signedParams": self._signed_params()})
        assert resp.status_code == 400

    def test_initialize_tampered_signature(self) -> None:
        # Signed with a different salt, so unsigning with SALT raises
        # BadSignature rather than SignatureExpired.
        tampered = sign(
            salt="not-the-jira-salt",
            external_id=self.external_id,
            metadata=json.dumps(self.metadata),
        )
        resp = self._initialize_pipeline(initial_data={"signedParams": tampered})
        assert resp.status_code == 400

    def test_advance_with_invalid_state_errors(self) -> None:
        self._initialize_pipeline(initial_data={"signedParams": self._signed_params()})
        resp = self._advance_step({"state": "not-the-pipeline-signature"})
        assert resp.status_code == 400
        assert not Integration.objects.filter(provider=self.provider.key).exists()

    def test_install(self) -> None:
        resp = self._initialize_pipeline(initial_data={"signedParams": self._signed_params()})
        pipeline_signature = resp.data["data"]["state"]

        resp = self._advance_step({"state": pipeline_signature})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.external_id == self.external_id
        assert integration.metadata == self.metadata
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()
