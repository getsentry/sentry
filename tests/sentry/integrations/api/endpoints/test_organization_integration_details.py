from unittest.mock import patch

import responses

from sentry import audit_log
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import ScheduledDeletion
from sentry.integrations.gitlab.integration import GitlabIntegration
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.identity import Identity

EXPLICIT_MAPPING_REMOVALS_FEATURE = "organizations:jira-explicit-mapping-removals"


class OrganizationIntegrationDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-integration-details"

    def setUp(self) -> None:
        super().setUp()

        self.login_as(user=self.user)
        self.integration = self.create_provider_integration(
            provider="gitlab", name="Gitlab", external_id="gitlab:1"
        )
        self.identity = Identity.objects.create(
            idp=self.create_identity_provider(type="gitlab", config={}, external_id="gitlab:1"),
            user=self.user,
            external_id="base_id",
            data={},
        )
        self.integration.add_organization(
            self.organization, self.user, default_auth_id=self.identity.id
        )

        with assume_test_silo_mode(SiloMode.CELL):
            self.repo = Repository.objects.create(
                provider="gitlab",
                name="getsentry/sentry",
                organization_id=self.organization.id,
                integration_id=self.integration.id,
            )


@control_silo_test
class OrganizationIntegrationDetailsGetTest(OrganizationIntegrationDetailsTest):
    def test_simple(self) -> None:
        response = self.get_success_response(self.organization.slug, self.integration.id)
        assert response.data["id"] == str(self.integration.id)


@control_silo_test
class OrganizationIntegrationDetailsPostTest(OrganizationIntegrationDetailsTest):
    method = "post"

    def test_update_config(self) -> None:
        config = {"setting": "new_value", "setting2": "baz"}
        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ):
            self.get_success_response(self.organization.slug, self.integration.id, **config)

        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization_id=self.organization.id
        )

        assert org_integration.config == config

        assert AuditLogEntry.objects.filter(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("INTEGRATION_EDIT"),
            target_object=self.integration.id,
            data={"provider": self.integration.provider, "name": "config"},
        ).exists()

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_config_records_project_mapping_changes(self) -> None:
        jira = self.create_provider_integration(provider="jira", name="Example Jira")
        jira.add_organization(self.organization, self.user)
        for external_id in ("1", "2"):
            self.create_integration_external_project(
                organization_id=self.organization.id,
                integration_id=jira.id,
                external_id=external_id,
                resolved_status="done",
                unresolved_status="in_progress",
            )

        self.get_success_response(
            self.organization.slug, jira.id, **{"sync_status_forward": {"1": None, "2": None}}
        )

        entry = AuditLogEntry.objects.get(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("INTEGRATION_PROJECT_MAPPINGS_UPDATE"),
            target_object=jira.id,
        )
        assert entry.actor_id == self.user.id
        assert entry.data["provider"] == "jira"
        assert entry.data["added_project_mappings"] == []
        assert sorted(entry.data["removed_project_mappings"], key=lambda m: m["external_id"]) == [
            {"external_id": "1", "on_resolve": "done", "on_unresolve": "in_progress"},
            {"external_id": "2", "on_resolve": "done", "on_unresolve": "in_progress"},
        ]
        assert audit_log.get(entry.event).render(entry) == (
            "updated project status mappings for the jira integration "
            "(0 added, 0 updated, 2 removed)"
        )

    @with_feature(EXPLICIT_MAPPING_REMOVALS_FEATURE)
    def test_update_config_omitting_project_mappings_records_nothing(self) -> None:
        """
        A payload that omits stored mappings changes nothing, so there is nothing to record --
        the audit log is a changelog, not a snapshot of the mappings at each save.
        """
        jira = self.create_provider_integration(provider="jira", name="Example Jira")
        jira.add_organization(self.organization, self.user)
        for external_id in ("1", "2"):
            self.create_integration_external_project(
                organization_id=self.organization.id,
                integration_id=jira.id,
                external_id=external_id,
                resolved_status="done",
                unresolved_status="in_progress",
            )

        self.get_success_response(self.organization.slug, jira.id, **{"sync_status_forward": {}})

        assert not AuditLogEntry.objects.filter(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("INTEGRATION_PROJECT_MAPPINGS_UPDATE"),
        ).exists()

    def test_update_config_rejects_malformed_project_mappings(self) -> None:
        """
        A non-mapping payload used to raise `AttributeError`, which the endpoint doesn't
        catch -- so it surfaced as a 500 rather than a 400.
        """
        jira = self.create_provider_integration(provider="jira", name="Example Jira")
        jira.add_organization(self.organization, self.user)

        response = self.get_error_response(
            self.organization.slug, jira.id, status_code=400, **{"sync_status_forward": True}
        )
        assert "detail" in response.data

    def test_update_config_skips_project_mapping_entry_when_unchanged(self) -> None:
        """Providers that report no mapping changes get only the `INTEGRATION_EDIT` entry."""
        config = {"setting": "new_value"}
        with patch(
            "sentry.integrations.gitlab.integration.repository_service.schedule_update_gitlab_project_webhooks"
        ):
            self.get_success_response(self.organization.slug, self.integration.id, **config)

        assert not AuditLogEntry.objects.filter(
            organization_id=self.organization.id,
            event=audit_log.get_event_id("INTEGRATION_PROJECT_MAPPINGS_UPDATE"),
        ).exists()

    def test_update_config_error(self) -> None:
        config = {"setting": "new_value", "setting2": "baz"}

        with patch.object(
            GitlabIntegration,
            "update_organization_config",
            side_effect=IntegrationError("hello"),
        ):
            response = self.get_error_response(
                self.organization.slug, self.integration.id, **config, status_code=400
            )
            assert response.data["detail"] == "hello"

        with patch.object(
            GitlabIntegration,
            "update_organization_config",
            side_effect=ApiError("hi"),
        ):
            response = self.get_error_response(
                self.organization.slug, self.integration.id, **config, status_code=400
            )
            assert response.data["detail"] == "hi"


@control_silo_test
class OrganizationIntegrationDetailsDeleteTest(OrganizationIntegrationDetailsTest):
    method = "delete"

    def test_removal(self) -> None:
        self.get_success_response(self.organization.slug, self.integration.id)
        assert Integration.objects.filter(id=self.integration.id).exists()

        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization_id=self.organization.id
        )
        assert ScheduledDeletion.objects.filter(
            model_name="OrganizationIntegration", object_id=org_integration.id
        )

    def test_delete_disabled_integration(self) -> None:
        org_integration = OrganizationIntegration.objects.get(
            integration=self.integration, organization_id=self.organization.id
        )
        org_integration.update(status=ObjectStatus.DISABLED)
        self.get_success_response(self.organization.slug, self.integration.id)
        assert Integration.objects.filter(id=self.integration.id).exists()

        org_integration.refresh_from_db()
        assert ScheduledDeletion.objects.filter(
            model_name="OrganizationIntegration", object_id=org_integration.id
        )


@control_silo_test
class IssueOrganizationIntegrationDetailsGetTest(APITestCase):
    endpoint = "sentry-api-0-organization-integration-details"
    method = "get"

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
        self.user.name = "Sentry Admin"
        self.user.save()
        self.login_as(self.user)
        self.integration.add_organization(self.organization, self.user)

    @responses.activate
    def test_serialize_organizationintegration_with_create_issue_config_for_jira(self) -> None:
        """Test the flow of choosing ticket creation on alert rule fire action
        then serializes the issue config correctly for Jira"""

        # Mock the legacy projects response
        responses.add(
            responses.GET,
            "https://example.atlassian.net/rest/api/2/project",
            json=[
                {"id": "10000", "key": "PROJ1", "name": "Project 1"},
                {"id": "10001", "key": "PROJ2", "name": "Project 2"},
            ],
        )

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

        params = {"action": "create"}
        installation = self.integration.get_installation(self.organization.id)
        response = self.get_success_response(
            self.organization.slug,
            self.integration.id,
            qs_params=params,
        )
        data = response.data

        # Check we serialized the integration correctly
        assert data["id"] == str(self.integration.id)
        assert data["name"] == self.integration.name
        assert data["icon"] == self.integration.metadata.get("icon")
        assert data["domainName"] == self.integration.metadata.get("domain_name")
        assert data["accountType"] == self.integration.metadata.get("account_type")
        assert data["scopes"] == self.integration.metadata.get("scopes")
        assert data["status"] == self.integration.get_status_display()

        # Check we serialized the provider correctly
        resp_provider = data["provider"]
        provider = self.integration.get_provider()
        assert resp_provider["key"] == provider.key
        assert resp_provider["slug"] == provider.key
        assert resp_provider["name"] == provider.name
        assert resp_provider["canAdd"] == provider.can_add
        assert resp_provider["canDisable"] == provider.can_disable
        assert resp_provider["features"] == sorted(f.value for f in provider.features)
        assert resp_provider["aspects"] == getattr(provider.metadata, "aspects", {})

        # Check we serialized the create issue config correctly
        assert installation.get_create_issue_config(None, self.user) == data.get(
            "createIssueConfig", {}
        )
        assert installation.get_organization_config() == data.get("configOrganization", {})

        # Check we serialized the other organization integration details correctly
        assert data["configData"] == installation.get_config_data()
        assert data["externalId"] == self.integration.external_id
        assert data["organizationId"] == self.organization.id
        assert (
            data["organizationIntegrationStatus"]
            == self.organization_integration.get_status_display()
        )
        assert data["gracePeriodEnd"] == self.organization_integration.grace_period_end
