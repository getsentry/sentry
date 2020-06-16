from __future__ import absolute_import

import responses
import six

from six.moves.urllib.parse import parse_qs, urlencode, urlparse

from sentry.integrations.slack import SlackIntegrationProvider
from sentry.integrations.slack.integration import _get_channels_from_rules
from sentry.models import (
    AuditLogEntry,
    AuditLogEntryEvent,
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    OrganizationIntegration,
)
from sentry.testutils import IntegrationTestCase
from sentry.utils.compat.mock import patch


class SlackMigrationTest(IntegrationTestCase):
    provider = SlackIntegrationProvider

    def setUp(self):
        super(SlackMigrationTest, self).setUp()
        self.team = self.create_team(
            organization=self.organization, name="Go Team", members=[self.user]
        )
        self.project = self.create_project(
            organization=self.organization, teams=[self.team], name="Bengal"
        )
        self.integration = Integration.objects.create(
            name="Example",
            provider="slack",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        OrganizationIntegration.objects.create(
            organization=self.organization, integration=self.integration
        )
        self.rule = self.create_slack_project_rule(
            project=self.project,
            integration_id=six.text_type(self.integration.id),
            channel_id="XXXXX",
        )
        self.init_path_verification_results = "%s%s" % (
            self.setup_path,
            "?show_verification_results",
        )
        self.init_path_channels = "%s%s" % (self.setup_path, "?start_migration")

    def assert_setup_flow(
        self,
        team_id="TXXXXXXX1",
        authorizing_user_id="UXXXXXXX1",
        expected_client_id="slack-client-id",
        expected_client_secret="slack-client-secret",
        check_channels=True,
    ):
        responses.reset()

        resp = self.client.get(
            u"{}?{}".format(self.init_path, urlencode({"integration_id": self.integration.id}))
        )
        assert resp.status_code == 200

        responses.add(
            responses.POST,
            "https://slack.com/api/conversations.info",
            json={"ok": True, "channel": {"is_private": True}},
        )
        resp = self.client.get(self.init_path_verification_results)
        assert resp.status_code == 200
        resp = self.client.get(self.init_path_channels)
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

        assert params.get("user_scope") == ["links:read"]
        # once we've asserted on it, switch to a singular values to make life
        # easier
        authorize_params = {k: v[0] for k, v in six.iteritems(params)}

        access_json = {
            "ok": True,
            "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            "team": {"id": team_id, "name": "Example"},
            "authed_user": {"id": authorizing_user_id},
        }
        responses.add(responses.POST, "https://slack.com/api/oauth.v2.access", json=access_json)

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
            u"{}?{}".format(
                self.setup_path,
                urlencode({"code": "oauth-code", "state": authorize_params["state"]}),
            )
        )

        if check_channels:
            mock_request = responses.calls[1].request
            req_params = parse_qs(mock_request.body)
            assert req_params["grant_type"] == ["authorization_code"]
            assert req_params["code"] == ["oauth-code"]
            assert req_params["redirect_uri"] == ["http://testserver/extensions/slack/setup/"]
            assert req_params["client_id"] == [expected_client_id]
            assert req_params["client_secret"] == [expected_client_secret]

        assert resp.status_code == 200
        self.assertDialogSuccess(resp)

    @patch("sentry.integrations.slack.post_migration.run_post_migration")
    @responses.activate
    def test_migration_flow(self, run_post_migration):
        self.assert_setup_flow()

        integration = Integration.objects.get(provider=self.provider.key)

        assert integration.external_id == "TXXXXXXX1"
        assert integration.name == "Example"
        md = integration.metadata
        assert md["access_token"] == "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        assert md["old_access_token"] == "xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"
        assert md["scopes"] == sorted(self.provider.identity_oauth_scopes)
        assert md["icon"] == "http://example.com/ws_icon.jpg"
        assert md["domain_name"] == "test-slack-workspace.slack.com"
        assert md["installation_type"] == "migrated_to_bot"
        assert md["migrated_at"]

        oi = OrganizationIntegration.objects.get(
            integration=integration, organization=self.organization
        )
        assert oi.config == {}

        idp = IdentityProvider.objects.get(type="slack", external_id="TXXXXXXX1")
        identity = Identity.objects.get(idp=idp, user=self.user, external_id="UXXXXXXX1")
        assert identity.status == IdentityStatus.VALID
        run_post_migration.apply_async.assert_called_with(
            kwargs={
                "integration_id": integration.id,
                "organization_id": self.organization.id,
                "user_id": self.user.id,
                "private_channels": [{"name": "#general", "id": "XXXXX"}],
                "missing_channels": [],
            }
        )

        audit_entry = AuditLogEntry.objects.get(event=AuditLogEntryEvent.INTEGRATION_UPGRADE)
        assert audit_entry.get_note() == "upgraded Example for the slack integration"

    def test_multiple_orgs_same_workspace(self):
        new_org = self.create_organization(owner=self.create_user())
        OrganizationIntegration.objects.create(organization=new_org, integration=self.integration)

        resp = self.client.get(
            u"{}?{}".format(self.init_path, urlencode({"integration_id": self.integration.id}))
        )
        assert resp.status_code == 200
        self.assertContains(resp, self.integration.name)
        self.assertContains(resp, new_org.slug)

    @responses.activate
    def test_multiple_orgs_same_workspace_audit_log_entries(self):
        new_org = self.create_organization(owner=self.create_user())
        OrganizationIntegration.objects.create(organization=new_org, integration=self.integration)

        self.assert_setup_flow()

        audit_entry1 = AuditLogEntry.objects.get(
            organization=self.organization, event=AuditLogEntryEvent.INTEGRATION_UPGRADE
        )
        assert audit_entry1.get_note() == "upgraded Example for the slack integration"

        audit_entry2 = AuditLogEntry.objects.get(
            organization=new_org, event=AuditLogEntryEvent.INTEGRATION_UPGRADE
        )
        assert audit_entry2.get_note() == "upgraded Example for the slack integration"

    @patch("sentry.integrations.slack.post_migration.run_post_migration")
    @responses.activate
    def test_migration_flow_no_channels(self, run_post_migration):
        self.rule.delete()
        self.assert_setup_flow(check_channels=False)
        assert len(run_post_migration.apply_async.mock_calls) == 0

    def test_invalid_integration_id(self):
        responses.reset()

        resp = self.client.get(u"{}?{}".format(self.init_path, urlencode({"integration_id": -1})))
        assert resp.status_code == 200
        self.assertContains(resp, "Setup Error")

    def test_get_channels_from_rules(self):
        new_rule = self.create_slack_project_rule(
            project=self.project,
            integration_id=six.text_type(self.integration.id),
            channel_name="#something",
        )
        # test that we don't error out if channel_id isn't saved
        del new_rule.data["actions"][0]["channel_id"]
        new_rule.save()
        channels = _get_channels_from_rules(self.organization, self.integration)
        assert len(channels) == 1
