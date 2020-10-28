from __future__ import absolute_import

import pytest
import six
import responses
from sentry.utils.compat.mock import patch, Mock

from sentry.shared_integrations.exceptions import IntegrationError
from sentry.integrations.vsts import VstsIntegration, VstsIntegrationProvider
from sentry.testutils.helpers import with_feature
from sentry.models import (
    Integration,
    IntegrationExternalProject,
    OrganizationIntegration,
    Repository,
    Project,
)
from sentry.plugins.base import plugins
from six.moves.urllib.parse import urlparse, parse_qs
from tests.sentry.plugins.testutils import (
    register_mock_plugins,
    unregister_mock_plugins,
    VstsPlugin,
)
from .testutils import VstsIntegrationTestCase, CREATE_SUBSCRIPTION

FULL_SCOPES = ["vso.code", "vso.graph", "vso.serviceendpoint_manage", "vso.work_write"]
LIMITED_SCOPES = ["vso.graph", "vso.serviceendpoint_manage", "vso.work_write"]


class VstsIntegrationProviderTest(VstsIntegrationTestCase):
    # Test data setup in ``VstsIntegrationTestCase``

    def setUp(self):
        super(VstsIntegrationProviderTest, self).setUp()
        register_mock_plugins()

    def tearDown(self):
        unregister_mock_plugins()
        super(VstsIntegrationProviderTest, self).tearDown()

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

    @with_feature("organizations:integrations-vsts-limited-scopes")
    def test_limited_scopes_flow(self):
        self.assert_installation()

        integration = Integration.objects.get(provider="vsts")

        assert integration.external_id == self.vsts_account_id
        assert integration.name == self.vsts_account_name

        metadata = integration.metadata
        assert metadata["scopes"] == LIMITED_SCOPES
        assert metadata["subscription"]["id"] == CREATE_SUBSCRIPTION["id"]
        assert metadata["domain_name"] == self.vsts_base_url

    def test_migrate_repositories(self):
        accessible_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name=self.project_a["name"],
            url=u"{}/_git/{}".format(self.vsts_base_url, self.repo_name),
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

        assert Repository.objects.get(id=accessible_repo.id).integration_id == integration.id

        assert Repository.objects.get(id=inaccessible_repo.id).integration_id is None

    def setup_plugin_test(self):
        self.project = Project.objects.create(organization_id=self.organization.id)
        VstsPlugin().enable(project=self.project)

    def test_disabled_plugin_when_fully_migrated(self):
        self.setup_plugin_test()

        Repository.objects.create(
            organization_id=self.organization.id,
            name=self.project_a["name"],
            url=u"https://{}.visualstudio.com/_git/{}".format(
                self.vsts_account_name, self.repo_name
            ),
            provider="visualstudio",
            external_id=self.repo_id,
            config={"name": self.project_a["name"], "project": self.project_a["name"]},
        )

        # Enabled before Integration installation
        assert "vsts" in [p.slug for p in plugins.for_project(self.project)]

        with self.tasks():
            self.assert_installation()

        # Disabled
        assert "vsts" not in [p.slug for p in plugins.for_project(self.project)]

    def test_doesnt_disable_plugin_when_partially_migrated(self):
        self.setup_plugin_test()

        # Repo accessible by new Integration
        Repository.objects.create(
            organization_id=self.organization.id,
            name=self.project_a["name"],
            url=u"https://{}.visualstudio.com/_git/{}".format(
                self.vsts_account_name, self.repo_name
            ),
            provider="visualstudio",
            external_id=self.repo_id,
        )

        # Inaccessible Repo - causes plugin to stay enabled
        Repository.objects.create(
            organization_id=self.organization.id,
            name="NotReachable",
            url="https://randoaccount.visualstudio.com/Product/_git/NotReachable",
            provider="visualstudio",
            external_id="123456789",
        )
        self.assert_installation()

        # Still enabled
        assert "vsts" in [p.slug for p in plugins.for_project(self.project)]

    def test_accounts_list_failure(self):
        responses.replace(
            responses.GET,
            "https://app.vssps.visualstudio.com/_apis/accounts?ownerId=%s&api-version=4.1"
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
        data = VstsIntegrationProvider().build_integration(state)
        assert "subscription" in data["metadata"]
        assert (
            Integration.objects.get(provider="vsts").metadata["subscription"]
            == data["metadata"]["subscription"]
        )

    @patch("sentry.integrations.vsts.VstsIntegrationProvider.get_scopes", return_value=FULL_SCOPES)
    def test_fix_subscription(self, mock_get_scopes):
        external_id = "1234567890"
        Integration.objects.create(metadata={}, provider="vsts", external_id=external_id)
        data = VstsIntegrationProvider().build_integration(
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
            u"https://{}.visualstudio.com/_apis/hooks/subscriptions".format(
                self.vsts_account_name.lower()
            ),
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

        with pytest.raises(IntegrationError) as err:
            integration.build_integration(state)
        assert "sufficient account access to create webhooks" in six.text_type(err)

    @patch("sentry.integrations.vsts.VstsIntegrationProvider.get_scopes", return_value=FULL_SCOPES)
    def test_create_subscription_unauthorized(self, mock_get_scopes):
        responses.replace(
            responses.POST,
            u"https://{}.visualstudio.com/_apis/hooks/subscriptions".format(
                self.vsts_account_name.lower()
            ),
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

        with pytest.raises(IntegrationError) as err:
            integration.build_integration(state)
        assert "sufficient account access to create webhooks" in six.text_type(err)


class VstsIntegrationTest(VstsIntegrationTestCase):
    def test_get_organization_config(self):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")

        fields = integration.get_installation(
            integration.organizations.first().id
        ).get_organization_config()

        assert [field["name"] for field in fields] == [
            "sync_status_forward",
            "sync_forward_assignment",
            "sync_comments",
            "sync_status_reverse",
            "sync_reverse_assignment",
        ]

    def test_get_organization_config_failure(self):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")
        installation = integration.get_installation(integration.organizations.first().id)

        # Set the `default_identity` property and force token expiration
        installation.get_client()
        installation.default_identity.data["expires"] = 1566851050

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
        data = {"sync_status_forward": {1: {"on_resolve": "", "on_unresolve": "UnresolvedStatus1"}}}
        with self.assertRaises(IntegrationError):
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

    @patch("sentry.integrations.vsts.client.VstsApiClient.update_work_item")
    def test_create_comment(self, mock_update_work_item):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")
        installation = integration.get_installation(self.organization.id)

        self.user.name = "Sentry Admin"
        self.user.save()

        comment_text = "hello world\nThis is a comment.\n\n\n    Glad it's quoted"
        comment = Mock()
        comment.data = {"text": comment_text}

        work_item = installation.create_comment(1, self.user.id, comment)

        assert work_item and work_item["id"]
        assert (
            mock_update_work_item.call_args[1]["comment"]
            == "Sentry Admin wrote:\n\n<blockquote>%s</blockquote>" % comment_text
        )

    def test_get_repositories(self):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")
        installation = integration.get_installation(self.organization.id)

        result = installation.get_repositories()
        assert len(result) == 1
        assert {"name": "ProjectA/cool-service", "identifier": self.repo_id} == result[0]

    def test_get_repositories_identity_error(self):
        self.assert_installation()
        integration = Integration.objects.get(provider="vsts")
        installation = integration.get_installation(self.organization.id)

        # Set the `default_identity` property and force token expiration
        installation.get_client()
        installation.default_identity.data["expires"] = 1566851050
        responses.replace(
            responses.POST,
            "https://app.vssps.visualstudio.com/oauth2/token",
            status=400,
            json={"error": "invalid_grant", "message": "The provided authorization grant failed"},
        )
        with pytest.raises(IntegrationError):
            installation.get_repositories()
