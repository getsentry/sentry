from urllib.parse import parse_qs, urlencode, urlparse

import responses
from responses.matchers import query_string_matcher

from sentry import audit_log
from sentry.integrations.slack import SlackIntegration, SlackIntegrationProvider
from sentry.integrations.slack.utils.users import SLACK_GET_USERS_PAGE_SIZE
from sentry.models import (
    AuditLogEntry,
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import APITestCase, IntegrationTestCase, TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SlackIntegrationTest(IntegrationTestCase):
    provider = SlackIntegrationProvider

    def assert_setup_flow(
        self,
        team_id="TXXXXXXX1",
        authorizing_user_id="UXXXXXXX1",
        expected_client_id="slack-client-id",
        expected_client_secret="slack-client-secret",
        customer_domain=None,
    ):
        responses.reset()

        kwargs = {}
        if customer_domain:
            kwargs["HTTP_HOST"] = customer_domain

        resp = self.client.get(self.init_path, **kwargs)
        assert resp.status_code == 302
        redirect = urlparse(resp["Location"])
        assert redirect.scheme == "https"
        assert redirect.netloc == "slack.com"
        assert redirect.path == "/oauth/v2/authorize"
        params = parse_qs(redirect.query)
        scopes = self.provider.identity_oauth_scopes
        assert params["scope"] == [" ".join(scopes)]
        assert params["state"]
        assert params["redirect_uri"] == ["http://testserver/extensions/slack/setup/"]
        assert params["response_type"] == ["code"]
        assert params["client_id"] == [expected_client_id]

        assert params.get("user_scope") == [" ".join(self.provider.user_scopes)]
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in params.items()}

        access_json = {
            "ok": True,
            "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            "team": {"id": team_id, "name": "Example"},
            "authed_user": {"id": authorizing_user_id},
        }
        responses.add(responses.POST, "https://slack.com/api/oauth.v2.access", json=access_json)

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            match=[query_string_matcher(f"limit={SLACK_GET_USERS_PAGE_SIZE}")],
            json={
                "ok": True,
                "members": [
                    {
                        "id": authorizing_user_id,
                        "team_id": team_id,
                        "deleted": False,
                        "profile": {
                            "email": self.user.email,
                            "team": team_id,
                        },
                    },
                ],
                "response_metadata": {"next_cursor": ""},
            },
        )
        responses.add(
            responses.GET,
            "https://slack.com/api/team.info",
            json={
                "ok": True,
                "team": {
                    "domain": "test-slack-workspace",
                    "icon": {"image_132": "http://example.com/ws_icon.jpg"},
                },
            },
        )
        resp = self.client.get(
            "{}?{}".format(
                self.setup_path,
                urlencode({"code": "oauth-code", "state": authorize_params["state"]}),
            )
        )

        if customer_domain:
            assert resp.status_code == 302
            assert resp["Location"].startswith(f"http://{customer_domain}/extensions/slack/setup/")
            resp = self.client.get(resp["Location"], **kwargs)

        mock_request = responses.calls[0].request
        req_params = parse_qs(mock_request.body)
        assert req_params["grant_type"] == ["authorization_code"]
        assert req_params["code"] == ["oauth-code"]
        assert req_params["redirect_uri"] == ["http://testserver/extensions/slack/setup/"]
        assert req_params["client_id"] == [expected_client_id]
        assert req_params["client_secret"] == [expected_client_secret]

        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

    @responses.activate
    def test_bot_flow(self):
        with self.tasks():
            self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.external_id == "TXXXXXXX1"
        assert integration.name == "Example"
        assert integration.metadata == {
            "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            "scopes": sorted(self.provider.identity_oauth_scopes),
            "icon": "http://example.com/ws_icon.jpg",
            "domain_name": "test-slack-workspace.slack.com",
            "installation_type": "born_as_bot",
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="slack", external_id="TXXXXXXX1")
        identity = Identity.objects.get(idp=idp, user=self.user, external_id="UXXXXXXX1")
        assert identity.status == IdentityStatus.VALID

        audit_entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("INTEGRATION_ADD"))
        audit_log_event = audit_log.get(audit_entry.event)
        assert audit_log_event.render(audit_entry) == "installed Example for the slack integration"

    @responses.activate
    def test_bot_flow_customer_domains(self):
        with self.tasks():
            self.assert_setup_flow(customer_domain=f"{self.organization.slug}.testserver")

        integration = Integration.objects.get(provider=self.provider.key)
        assert integration.external_id == "TXXXXXXX1"
        assert integration.name == "Example"
        assert integration.metadata == {
            "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            "scopes": sorted(self.provider.identity_oauth_scopes),
            "icon": "http://example.com/ws_icon.jpg",
            "domain_name": "test-slack-workspace.slack.com",
            "installation_type": "born_as_bot",
        }
        oi = OrganizationIntegration.objects.get(
            integration=integration, organization_id=self.organization.id
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="slack", external_id="TXXXXXXX1")
        identity = Identity.objects.get(idp=idp, user=self.user, external_id="UXXXXXXX1")
        assert identity.status == IdentityStatus.VALID

        audit_entry = AuditLogEntry.objects.get(event=audit_log.get_event_id("INTEGRATION_ADD"))
        audit_log_event = audit_log.get(audit_entry.event)
        assert audit_log_event.render(audit_entry) == "installed Example for the slack integration"

    @responses.activate
    def test_multiple_integrations(self):
        with self.tasks():
            self.assert_setup_flow()
        with self.tasks():
            self.assert_setup_flow(team_id="TXXXXXXX2", authorizing_user_id="UXXXXXXX2")

        integrations = Integration.objects.filter(provider=self.provider.key).order_by(
            "external_id"
        )

        assert integrations.count() == 2
        assert integrations[0].external_id == "TXXXXXXX1"
        assert integrations[1].external_id == "TXXXXXXX2"

        oi = OrganizationIntegration.objects.get(
            integration=integrations[1], organization_id=self.organization.id
        )
        assert oi.config == {}

        idps = IdentityProvider.objects.filter(type="slack")

        assert idps.count() == 2

        identities = Identity.objects.all()

        assert identities.count() == 2
        assert identities[0].external_id != identities[1].external_id
        assert identities[0].idp != identities[1].idp

    @responses.activate
    def test_reassign_user(self):
        """Test that when you install and then later re-install and the user who installs it
        has a different external ID, their Identity is updated to reflect that
        """
        with self.tasks():
            self.assert_setup_flow()
        identity = Identity.objects.get()
        assert identity.external_id == "UXXXXXXX1"
        with self.tasks():
            self.assert_setup_flow(authorizing_user_id="UXXXXXXX2")
        identity = Identity.objects.get()
        assert identity.external_id == "UXXXXXXX2"


class SlackIntegrationPostInstallTest(APITestCase):
    def setUp(self):
        self.user2 = self.create_user("foo@example.com")
        self.member = self.create_member(
            user=self.user2,
            organization=self.organization,
            role="manager",
            teams=[self.team],
        )
        self.user3 = self.create_user("hellboy@example.com")
        self.member = self.create_member(
            user=self.user3,
            organization=self.organization,
            role="manager",
            teams=[self.team],
        )
        self.user4 = self.create_user("ialreadyexist@example.com")
        self.member = self.create_member(
            user=self.user4,
            organization=self.organization,
            role="manager",
            teams=[self.team],
        )
        self.integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        self.integration.add_organization(self.organization, self.user)
        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        Identity.objects.create(
            external_id="UXXXXXXX4",
            idp=self.idp,
            user=self.user4,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            match=[query_string_matcher(f"limit={SLACK_GET_USERS_PAGE_SIZE}")],
            json={
                "ok": True,
                "members": [
                    {
                        "id": "UXXXXXXX1",
                        "team_id": "TXXXXXXX1",
                        "deleted": False,
                        "profile": {
                            "email": self.user.email,
                            "team": "TXXXXXXX1",
                        },
                    },
                    {
                        "id": "UXXXXXXX2",
                        "team_id": "TXXXXXXX1",
                        "deleted": False,
                        "profile": {
                            "email": self.user2.email,
                            "team": "TXXXXXXX1",
                        },
                    },
                    {
                        "id": "UXXXXXXX3",
                        "team_id": "TXXXXXXX1",
                        "deleted": False,
                        "profile": {
                            "email": "wrongemail@example.com",
                            "team": "TXXXXXXX1",
                        },
                    },
                    {
                        "id": "UXXXXXXX4",
                        "team_id": "TXXXXXXX1",
                        "deleted": False,
                        "profile": {
                            "email": "ialreadyexist@example.com",
                            "team": "TXXXXXXX1",
                        },
                    },
                ],
                "response_metadata": {"next_cursor": ""},
            },
        )

    @responses.activate
    def test_link_multiple_users(self):
        """
        Test that with an organization with multiple users, we create Identity records for them
        if their Sentry email matches their Slack email
        """
        with self.tasks():
            SlackIntegrationProvider().post_install(self.integration, self.organization)

        user1_identity = Identity.objects.get(user=self.user)
        assert user1_identity
        assert user1_identity.external_id == "UXXXXXXX1"
        assert user1_identity.user.email == "admin@localhost"

        user2_identity = Identity.objects.get(user=self.user2)
        assert user2_identity
        assert user2_identity.external_id == "UXXXXXXX2"
        assert user2_identity.user.email == "foo@example.com"

    @responses.activate
    def test_email_no_match(self):
        """
        Test that a user whose email does not match does not have an Identity created
        """
        with self.tasks():
            SlackIntegrationProvider().post_install(self.integration, self.organization)

        identities = Identity.objects.all()
        assert identities.count() == 3

    @responses.activate
    def test_update_identity(self):
        """
        Test that when an additional user who already has an Identity's Slack external ID
        changes, that we update the Identity's external ID to match
        """
        with self.tasks():
            SlackIntegrationProvider().post_install(self.integration, self.organization)

        user3_identity = Identity.objects.get(user=self.user4)
        assert user3_identity
        assert user3_identity.external_id == "UXXXXXXX4"
        assert user3_identity.user.email == "ialreadyexist@example.com"


@control_silo_test
class SlackIntegrationConfigTest(TestCase):
    def setUp(self):
        self.integration = Integration.objects.create(provider="slack", name="Slack", metadata={})
        self.installation = SlackIntegration(self.integration, self.organization.id)

    def test_config_data_workspace_app(self):
        self.installation.get_config_data()["installationType"] = "workspace_app"

    def test_config_data_user_token(self):
        self.integration.metadata["user_access_token"] = "token"
        self.installation.get_config_data()["installationType"] = "classic_bot"

    def test_config_data_born_as_bot(self):
        self.integration.metadata["installation_type"] = "born_as_bot"
        self.installation.get_config_data()["installationType"] = "born_as_bot"
