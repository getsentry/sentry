from __future__ import annotations

from typing import Any
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

import pytest
import responses

from fixtures.vsts import CREATE_SUBSCRIPTION, VstsIntegrationTestCase
from sentry.identity.vsts.provider import VSTSNewIdentityProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import ensure_integration
from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.vsts import VstsIntegration, VstsIntegrationProvider
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import IntegrationError, IntegrationProviderError
from sentry.silo.base import SiloMode
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.identity import Identity

FULL_SCOPES = ["vso.code", "vso.graph", "vso.serviceendpoint_manage", "vso.work_write"]
LIMITED_SCOPES = ["vso.graph", "vso.serviceendpoint_manage", "vso.work_write"]


@control_silo_test
class VstsIntegrationMigrationTest(VstsIntegrationTestCase):

    # Test regular install still works
    @with_feature("organizations:migrate-azure-devops-integration")
    @patch(
        "sentry.integrations.vsts.VstsIntegrationProvider.get_scopes",
        return_value=VstsIntegrationProvider.NEW_SCOPES,
    )
    @patch(
        "sentry.identity.pipeline.IdentityProviderPipeline.get_provider",
        return_value=VSTSNewIdentityProvider(),
    )
    def test_original_installation_still_works(self, mock_get_scopes, mock_get_provider):
        self.pipeline = Mock()
        self.pipeline.organization = self.organization
        self.assert_installation(new=True)
        integration = Integration.objects.get(provider="vsts")
        assert integration.external_id == self.vsts_account_id
        assert integration.name == self.vsts_account_name

        metadata = integration.metadata
        assert set(metadata["scopes"]) == set(VstsIntegrationProvider.NEW_SCOPES)
        assert metadata["subscription"]["id"] == CREATE_SUBSCRIPTION["id"]
        assert metadata["domain_name"] == self.vsts_base_url

    # Test that install second time doesn't have the metadata and updates the integration object
    # Assert that the Integration object now has the migrated metadata
    @with_feature("organizations:migrate-azure-devops-integration")
    @patch(
        "sentry.integrations.vsts.VstsIntegrationProvider.get_scopes",
        return_value=VstsIntegrationProvider.NEW_SCOPES,
    )
    def test_migration(self, mock_get_scopes):
        state = {
            "account": {"accountName": self.vsts_account_name, "accountId": self.vsts_account_id},
            "base_url": self.vsts_base_url,
            "identity": {
                "data": {
                    "access_token": self.access_token,
                    "expires_in": "3600",
                    "refresh_token": self.refresh_token,
                    "token_type": "jwt-bearer",
                }
            },
        }

        external_id = self.vsts_account_id
        # Create the integration with old integration metadata
        old_integraton_obj = self.create_provider_integration(
            metadata=state, provider="vsts", external_id=external_id
        )
        assert old_integraton_obj.metadata.get("subscription", None) is None

        provider = VstsIntegrationProvider()
        pipeline = Mock()
        pipeline.organization = self.organization
        provider.set_pipeline(pipeline)

        data = provider.build_integration(
            {
                "account": {"accountName": self.vsts_account_name, "accountId": external_id},
                "base_url": self.vsts_base_url,
                "identity": {
                    "data": {
                        "access_token": "new_access_token",
                        "expires_in": "3600",
                        "refresh_token": "new_refresh_token",
                        "token_type": "bearer",
                    }
                },
            }
        )
        assert external_id == data["external_id"]
        subscription = data["metadata"]["subscription"]
        assert subscription["id"] is not None and subscription["secret"] is not None
        metadata = data.get("metadata")
        assert metadata is not None
        assert set(metadata["scopes"]) == set(VstsIntegrationProvider.NEW_SCOPES)
        assert metadata["integration_migration_version"] == 1

        # Make sure the integration object is updated
        # ensure_integration will be called in _finish_pipeline
        new_integration_obj = ensure_integration("vsts", data)
        assert new_integration_obj.metadata["integration_migration_version"] == 1
        assert set(new_integration_obj.metadata["scopes"]) == set(
            VstsIntegrationProvider.NEW_SCOPES
        )


@control_silo_test
class VstsIntegrationProviderTest(VstsIntegrationTestCase):
    # Test data setup in ``VstsIntegrationTestCase``

    def test_basic_flow(self):
        self.assert_installation()

        integration = Integration.objects.get(provider="vsts")

        assert integration.external_id == self.vsts_account_id
        assert integration.name == self.vsts_account_name

        metadata = integration.metadata
        assert metadata["scopes"] == [
            "vso.code",
            "vso.graph",
            "vso.serviceendpoint_manage",
            "vso.work_write",
        ]
        assert metadata["subscription"]["id"] == CREATE_SUBSCRIPTION["id"]
        assert metadata["domain_name"] == self.vsts_base_url

    def test_migrate_repositories(self):
        with assume_test_silo_mode(SiloMode.REGION):
            accessible_repo = Repository.objects.create(
                organization_id=self.organization.id,
                name=self.project_a["name"],
                url=f"{self.vsts_base_url}/_git/{self.repo_name}",
                provider="visualstudio",
                external_id=self.repo_id,
                config={"name": self.project_a["name"], "project": self.project_a["name"]},
            )

            inaccessible_repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="NotReachable",
                url="https://randoaccount.visualstudio.com/Product/_git/NotReachable",
                provider="visualstudio",
                external_id="123456789",
                config={"name": "NotReachable", "project": "NotReachable"},
            )

        with self.tasks():
            self.assert_installation()
        integration = Integration.objects.get(provider="vsts")

        with assume_test_silo_mode(SiloMode.REGION):
            assert Repository.objects.get(id=accessible_repo.id).integration_id == integration.id
            assert Repository.objects.get(id=inaccessible_repo.id).integration_id is None

    def assert_failure_metric(self, mock_record, error_msg):
        (event_failures,) = (
            call for call in mock_record.mock_calls if call.args[0] == EventLifecycleOutcome.FAILURE
        )
        assert event_failures.args[1] == error_msg

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_accounts_list_failure(self, mock_record):
        responses.replace(
            responses.GET,
            "https://app.vssps.visualstudio.com/_apis/accounts?memberId=%s&api-version=4.1"
            % self.vsts_user_id,
            status=403,
            json={"$id": 1, "message": "Your account is not good"},
        )
        resp = self.make_init_request()
        assert resp.status_code < 400, resp.content

        redirect = urlparse(resp["Location"])
        query = parse_qs(redirect.query)

        # OAuth redirect back to Sentry (identity_pipeline_view)
        resp = self.make_oauth_redirect_request(query["state"][0])
        assert resp.status_code == 200, resp.content
        assert b"No accounts found" in resp.content

        self.assert_failure_metric(mock_record, "no_accounts")

    @patch("sentry.integrations.vsts.VstsIntegrationProvider.get_scopes", return_value=FULL_SCOPES)
    def test_webhook_subscription_created_once(self, mock_get_scopes):
        self.assert_installation()

        state = {
            "account": {"accountName": self.vsts_account_name, "accountId": self.vsts_account_id},
            "base_url": self.vsts_base_url,
            "identity": {
                "data": {
                    "access_token": self.access_token,
                    "expires_in": "3600",
                    "refresh_token": self.refresh_token,
                    "token_type": "jwt-bearer",
                }
            },
        }

        # The above already created the Webhook, so subsequent calls to
        # ``build_integration`` should omit that data.
        provider = VstsIntegrationProvider()
        pipeline = Mock()
        pipeline.organization = self.organization
        provider.set_pipeline(pipeline)
        data = provider.build_integration(state)
        assert "subscription" in data["metadata"]
        assert (
            Integration.objects.get(provider="vsts").metadata["subscription"]
            == data["metadata"]["subscription"]
        )

    @patch("sentry.integrations.vsts.VstsIntegrationProvider.get_scopes", return_value=FULL_SCOPES)
    def test_fix_subscription(self, mock_get_scopes):
        external_id = self.vsts_account_id
        self.create_provider_integration(metadata={}, provider="vsts", external_id=external_id)
        provider = VstsIntegrationProvider()
        pipeline = Mock()
        pipeline.organization = self.organization
        provider.set_pipeline(pipeline)
        data = provider.build_integration(
            {
                "account": {"accountName": self.vsts_account_name, "accountId": external_id},
                "base_url": self.vsts_base_url,
                "identity": {
                    "data": {
                        "access_token": self.access_token,
                        "expires_in": "3600",
                        "refresh_token": self.refresh_token,
                        "token_type": "jwt-bearer",
                    }
                },
            }
        )
        assert external_id == data["external_id"]
        subscription = data["metadata"]["subscription"]
        assert subscription["id"] is not None and subscription["secret"] is not None

    @responses.activate
    def test_source_url_matches(self):
        self.assert_installation()
        integration, installation = self._get_integration_and_install()

        test_cases = [
            (
                "https://MyVSTSAccount.visualstudio.com/sentry-backend-monitoring/_git/sentry-backend-monitoring?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents",
                True,
            ),
            (
                "https://MyVSTSAccount.visualstudio.com/DefaultCollection/sentry-backend-monitoring/_git/sentry-backend-monitoring?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents",
                True,
            ),
            (
                "https://MyVSTSAccount.visualstudio.com/sentry-backend-monitoring/_git/sentry-backend-monitoring?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents",
                True,
            ),
            (
                "https://MyVSTSAccount.notvisualstudio.com/sentry-backend-monitoring/_git/sentry-backend-monitoring?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents",
                False,
            ),
            (
                "https://MyVSTSAccount.notvisualstudio.com/DefaultCollection/sentry-backend-monitoring/_git/sentry-backend-monitoring?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents",
                False,
            ),
            ("https://jianyuan.io", False),
        ]
        for source_url, matches in test_cases:
            assert installation.source_url_matches(source_url) == matches

    @responses.activate
    def test_extract_branch_from_source_url(self):
        self.assert_installation()
        integration, installation = self._get_integration_and_install()

        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name=self.project_a["name"],
                url=f"{self.vsts_base_url}/_git/{self.repo_name}",
                provider="visualstudio",
                external_id=self.repo_id,
                config={"name": self.project_a["name"], "project": self.project_a["name"]},
            )

        test_cases = [
            f'{self.vsts_base_url}/{self.project_a["name"]}/_git/{self.repo_name}?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents',
            f"{self.vsts_base_url}/DefaultCollection/_git/{self.repo_name}?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents",
            f"{self.vsts_base_url}/_git/{self.repo_name}?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents",
        ]
        for source_url in test_cases:
            assert installation.extract_branch_from_source_url(repo, source_url) == "master"

    @responses.activate
    def test_extract_source_path_from_source_url(self):
        self.assert_installation()
        integration, installation = self._get_integration_and_install()

        with assume_test_silo_mode(SiloMode.REGION):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name=self.project_a["name"],
                url=f"{self.vsts_base_url}/_git/{self.repo_name}",
                provider="visualstudio",
                external_id=self.repo_id,
                config={"name": self.project_a["name"], "project": self.project_a["name"]},
            )

        test_cases = [
            f'{self.vsts_base_url}/{self.project_a["name"]}/_git/{self.repo_name}?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents',
            f"{self.vsts_base_url}/DefaultCollection/_git/{self.repo_name}?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents",
            f"{self.vsts_base_url}/_git/{self.repo_name}?path=%2Fmyapp%2Fviews.py&version=GBmaster&_a=contents",
        ]
        for source_url in test_cases:
            assert (
                installation.extract_source_path_from_source_url(repo, source_url)
                == "myapp/views.py"
            )


@control_silo_test
class VstsIntegrationProviderBuildIntegrationTest(VstsIntegrationTestCase):
    @patch("sentry.integrations.vsts.VstsIntegrationProvider.get_scopes", return_value=FULL_SCOPES)
    def test_success(self, mock_get_scopes):
        state = {
            "account": {"accountName": self.vsts_account_name, "accountId": self.vsts_account_id},
            "base_url": self.vsts_base_url,
            "identity": {
                "data": {
                    "access_token": self.access_token,
                    "expires_in": "3600",
                    "refresh_token": self.refresh_token,
                    "token_type": "jwt-bearer",
                }
            },
        }

        integration = VstsIntegrationProvider()
        pipeline = Mock()
        pipeline.organization = self.organization
        integration.set_pipeline(pipeline)
        integration_dict = integration.build_integration(state)

        assert integration_dict["name"] == self.vsts_account_name
        assert integration_dict["external_id"] == self.vsts_account_id
        assert integration_dict["metadata"]["domain_name"] == self.vsts_base_url

        assert integration_dict["user_identity"]["type"] == "vsts"
        assert integration_dict["user_identity"]["external_id"] == self.vsts_account_id
        assert integration_dict["user_identity"]["scopes"] == FULL_SCOPES

    @patch("sentry.integrations.vsts.VstsIntegrationProvider.get_scopes", return_value=FULL_SCOPES)
    def test_create_subscription_forbidden(self, mock_get_scopes):
        responses.replace(
            responses.POST,
            f"https://{self.vsts_account_name.lower()}.visualstudio.com/_apis/hooks/subscriptions",
            status=403,
            json={
                "$id": 1,
                "message": "The user bob is does not have permission to access this resource",
                "typeKey": "UnauthorizedRequestException",
                "errorCode": 0,
                "eventId": 3000,
            },
        )
        state = {
            "account": {"accountName": self.vsts_account_name, "accountId": self.vsts_account_id},
            "base_url": self.vsts_base_url,
            "identity": {
                "data": {
                    "access_token": self.access_token,
                    "expires_in": "3600",
                    "refresh_token": self.refresh_token,
                    "token_type": "jwt-bearer",
                }
            },
        }

        integration = VstsIntegrationProvider()
        pipeline = Mock()
        pipeline.organization = self.organization
        integration.set_pipeline(pipeline)
        with pytest.raises(IntegrationProviderError) as err:
            integration.build_integration(state)
        assert "Azure DevOps organization" in str(err) and "Please ensu" in str(err)

    @patch("sentry.integrations.vsts.VstsIntegrationProvider.get_scopes", return_value=FULL_SCOPES)
    def test_create_subscription_unauthorized(self, mock_get_scopes):
        responses.replace(
            responses.POST,
            f"https://{self.vsts_account_name.lower()}.visualstudio.com/_apis/hooks/subscriptions",
            status=401,
            json={
                "$id": 1,
                "message": "The user bob is not authorized to access this resource",
                "typeKey": "UnauthorizedRequestException",
                "errorCode": 0,
                "eventId": 3000,
            },
        )
        state = {
            "account": {"accountName": self.vsts_account_name, "accountId": self.vsts_account_id},
            "base_url": self.vsts_base_url,
            "identity": {
                "data": {
                    "access_token": self.access_token,
                    "expires_in": "3600",
                    "refresh_token": self.refresh_token,
                    "token_type": "jwt-bearer",
                }
            },
        }

        integration = VstsIntegrationProvider()
        pipeline = Mock()
        pipeline.organization = self.organization
        integration.set_pipeline(pipeline)
        with pytest.raises(IntegrationProviderError) as err:
            integration.build_integration(state)
        assert "Azure DevOps organization" in str(err) and "Please ensu" in str(err)


@control_silo_test
class VstsIntegrationTest(VstsIntegrationTestCase):
    def test_get_organization_config(self):
        self.assert_installation()
        integration, installation = self._get_integration_and_install()

        fields = installation.get_organization_config()

        assert [field["name"] for field in fields] == [
            "sync_status_forward",
            "sync_forward_assignment",
            "sync_comments",
            "sync_status_reverse",
            "sync_reverse_assignment",
        ]

    def test_get_organization_config_failure(self):
        self.assert_installation()
        integration, installation = self._get_integration_and_install()

        # Set the `default_identity` property and force token expiration
        installation.get_client()
        assert installation.default_identity is not None
        identity = Identity.objects.get(id=installation.default_identity.id)
        identity.data["expires"] = 1566851050
        identity.save()

        responses.replace(
            responses.POST,
            "https://app.vssps.visualstudio.com/oauth2/token",
            status=400,
            json={"error": "invalid_grant", "message": "The provided authorization grant failed"},
        )
        fields = installation.get_organization_config()
        assert fields[0]["disabled"], "Fields should be disabled"

    def test_update_organization_config_remove_all(self):
        self.assert_installation()

        model = Integration.objects.get(provider="vsts")
        integration = VstsIntegration(model, self.organization.id)

        org_integration = OrganizationIntegration.objects.get(organization_id=self.organization.id)

        data = {"sync_status_forward": {}, "other_option": "hello"}
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=1,
            resolved_status="ResolvedStatus1",
            unresolved_status="UnresolvedStatus1",
        )
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=2,
            resolved_status="ResolvedStatus2",
            unresolved_status="UnresolvedStatus2",
        )
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=3,
            resolved_status="ResolvedStatus3",
            unresolved_status="UnresolvedStatus3",
        )

        integration.update_organization_config(data)

        external_projects = IntegrationExternalProject.objects.all().values_list(
            "external_id", flat=True
        )

        assert list(external_projects) == []

        config = OrganizationIntegration.objects.get(
            organization_id=org_integration.organization_id,
            integration_id=org_integration.integration_id,
        ).config

        assert config == {"sync_status_forward": False, "other_option": "hello"}

    def test_update_organization_config(self):
        self.assert_installation()

        org_integration = OrganizationIntegration.objects.get(organization_id=self.organization.id)

        model = Integration.objects.get(provider="vsts")
        integration = VstsIntegration(model, self.organization.id)

        # test validation
        data: dict[str, Any] = {
            "sync_status_forward": {1: {"on_resolve": "", "on_unresolve": "UnresolvedStatus1"}}
        }
        with pytest.raises(IntegrationError):
            integration.update_organization_config(data)

        data = {
            "sync_status_forward": {
                1: {"on_resolve": "ResolvedStatus1", "on_unresolve": "UnresolvedStatus1"},
                2: {"on_resolve": "ResolvedStatus2", "on_unresolve": "UnresolvedStatus2"},
                4: {"on_resolve": "ResolvedStatus4", "on_unresolve": "UnresolvedStatus4"},
            },
            "other_option": "hello",
        }
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=1,
            resolved_status="UpdateMe",
            unresolved_status="UpdateMe",
        )
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=2,
            resolved_status="ResolvedStatus2",
            unresolved_status="UnresolvedStatus2",
        )
        IntegrationExternalProject.objects.create(
            organization_integration_id=org_integration.id,
            external_id=3,
            resolved_status="ResolvedStatus3",
            unresolved_status="UnresolvedStatus3",
        )

        integration.update_organization_config(data)

        external_projects = IntegrationExternalProject.objects.all().order_by("external_id")

        assert external_projects[0].external_id == "1"
        assert external_projects[0].resolved_status == "ResolvedStatus1"
        assert external_projects[0].unresolved_status == "UnresolvedStatus1"

        assert external_projects[1].external_id == "2"
        assert external_projects[1].resolved_status == "ResolvedStatus2"
        assert external_projects[1].unresolved_status == "UnresolvedStatus2"

        assert external_projects[2].external_id == "4"
        assert external_projects[2].resolved_status == "ResolvedStatus4"
        assert external_projects[2].unresolved_status == "UnresolvedStatus4"

        config = OrganizationIntegration.objects.get(
            organization_id=org_integration.organization_id,
            integration_id=org_integration.integration_id,
        ).config

        assert config == {"sync_status_forward": True, "other_option": "hello"}

    def test_update_domain_name(self):
        account_name = "MyVSTSAccount.visualstudio.com"
        account_uri = "https://MyVSTSAccount.visualstudio.com/"

        self.assert_installation()

        model = Integration.objects.get(provider="vsts")
        model.metadata["domain_name"] = account_name
        model.save()

        integration = VstsIntegration(model, self.organization.id)
        integration.get_client()

        domain_name = integration.model.metadata["domain_name"]
        assert domain_name == account_uri
        assert Integration.objects.get(provider="vsts").metadata["domain_name"] == account_uri

    def test_get_repositories(self):
        self.assert_installation()
        integration, installation = self._get_integration_and_install()

        result = installation.get_repositories()
        assert len(result) == 1
        assert {"name": "ProjectA/cool-service", "identifier": self.repo_id} == result[0]

    def test_get_repositories_identity_error(self):
        self.assert_installation()
        integration, installation = self._get_integration_and_install()

        # Set the `default_identity` property and force token expiration
        installation.get_client()
        assert installation.default_identity is not None
        identity = Identity.objects.get(id=installation.default_identity.id)
        identity.data["expires"] = 1566851050
        identity.save()

        responses.replace(
            responses.POST,
            "https://app.vssps.visualstudio.com/oauth2/token",
            status=400,
            json={"error": "invalid_grant", "message": "The provided authorization grant failed"},
        )
        with pytest.raises(IntegrationError):
            installation.get_repositories()


class RegionVstsIntegrationTest(VstsIntegrationTestCase):
    def setUp(self):
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.assert_installation()
            _, self.installation = self._get_integration_and_install()
            self.user.name = "Sentry Admin"
            self.user.save()

    @patch("sentry.integrations.vsts.client.VstsApiClient.update_work_item")
    def test_create_comment(self, mock_update_work_item):
        comment_text = "hello world\nThis is a comment.\n\n\n    Glad it's quoted"
        comment = Mock()
        comment.data = {"text": comment_text}

        work_item = self.installation.create_comment(1, self.user.id, comment)

        assert work_item and work_item["id"]
        assert (
            mock_update_work_item.call_args[1]["comment"]
            == "Sentry Admin wrote:\n\n<blockquote>%s</blockquote>" % comment_text
        )

    def test_update_comment(self):
        group_note = Mock()
        comment = "hello world\nThis is a comment.\n\n\n    I've changed it"
        group_note.data = {"text": comment, "external_id": "123"}

        # Does nothing.
        self.installation.update_comment(1, self.user.id, group_note)
