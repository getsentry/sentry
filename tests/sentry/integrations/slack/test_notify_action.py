from urllib.parse import parse_qs

import responses

from sentry.constants import ObjectStatus
from sentry.integrations.slack import SlackNotifyServiceAction
from sentry.integrations.slack.utils import SLACK_RATE_LIMITED_MESSAGE
from sentry.models import Integration, OrganizationIntegration
from sentry.notifications.additional_attachment_manager import manager
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers import install_slack
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


def additional_attachment_generator(integration, organization):
    # nonsense to make sure we pass in the right fields
    return {"title": organization.slug, "text": integration.id}


class SlackNotifyActionTest(RuleTestCase):
    rule_cls = SlackNotifyServiceAction

    def setUp(self):
        self.integration = install_slack(self.get_event().project.organization)

    def tearDown(self):
        manager.attachment_generators[ExternalProviders.SLACK] = None

    def assert_form_valid(self, form, expected_channel_id, expected_channel):
        assert form.is_valid()
        assert form.cleaned_data["channel_id"] == expected_channel_id
        assert form.cleaned_data["channel"] == expected_channel

    @responses.activate
    def test_no_upgrade_notice_bot_app(self):
        event = self.get_event()

        rule = self.get_rule(data={"workspace": self.integration.id, "channel": "#my-channel"})

        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        # Trigger rule callback
        results[0].callback(event, futures=[])
        data = parse_qs(responses.calls[0].request.body)

        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])

        assert len(attachments) == 1
        assert attachments[0]["title"] == event.title

    def test_render_label(self):
        rule = self.get_rule(
            data={
                "workspace": self.integration.id,
                "channel": "#my-channel",
                "channel_id": "",
                "tags": "one, two",
            }
        )

        assert (
            rule.render_label()
            == "Send a notification to the Awesome Team Slack workspace to #my-channel (optionally, an ID: ) and show tags [one, two] in notification"
        )

    def test_render_label_without_integration(self):
        self.integration.delete()

        rule = self.get_rule(
            data={
                "workspace": self.integration.id,
                "channel": "#my-channel",
                "channel_id": "",
                "tags": "",
            }
        )

        label = rule.render_label()
        assert (
            label
            == "Send a notification to the [removed] Slack workspace to #my-channel (optionally, an ID: ) and show tags [] in notification"
        )

    @responses.activate
    def test_valid_bot_channel_selected(self):
        integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX2",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "domain_name": "sentry.slack.com",
                "installation_type": "born_as_bot",
            },
        )
        integration.add_organization(self.event.project.organization, self.user)
        rule = self.get_rule(
            data={"workspace": integration.id, "channel": "#my-channel", "tags": ""}
        )

        channels = {
            "ok": "true",
            "channels": [
                {"name": "my-channel", "id": "chan-id"},
                {"name": "other-chann", "id": "chan-id"},
            ],
        }

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )

        form = rule.get_form_instance()
        assert form.is_valid()
        self.assert_form_valid(form, "chan-id", "#my-channel")

    @responses.activate
    def test_valid_member_selected(self):
        rule = self.get_rule(
            data={"workspace": self.integration.id, "channel": "@morty", "tags": ""}
        )

        channels = {
            "ok": "true",
            "channels": [
                {"name": "my-channel", "id": "chan-id"},
                {"name": "other-chann", "id": "chan-id"},
            ],
        }

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )

        members = {
            "ok": "true",
            "members": [
                {"name": "morty", "id": "morty-id"},
                {"name": "other-user", "id": "user-id"},
            ],
        }

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            status=200,
            content_type="application/json",
            body=json.dumps(members),
        )

        form = rule.get_form_instance()
        self.assert_form_valid(form, "morty-id", "@morty")

    @responses.activate
    def test_invalid_channel_selected(self):
        rule = self.get_rule(
            data={"workspace": self.integration.id, "channel": "#my-channel", "tags": ""}
        )

        channels = {"ok": "true", "channels": [{"name": "other-chann", "id": "chan-id"}]}

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )

        members = {"ok": "true", "members": [{"name": "other-member", "id": "member-id"}]}

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            status=200,
            content_type="application/json",
            body=json.dumps(members),
        )

        form = rule.get_form_instance()

        assert not form.is_valid()
        assert len(form.errors) == 1

    @responses.activate
    def test_rate_limited_response(self):
        """Should surface a 429 from Slack to the frontend form"""
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true", "channel": {"name": "my-channel", "id": "C2349874"}}),
        )
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=429,
            content_type="application/json",
            body=json.dumps(
                {
                    "ok": "false",
                    "error": "ratelimited",
                }
            ),
        )

        rule = self.get_rule(
            data={
                "workspace": self.integration.id,
                "channel": "#my-channel",
                "input_channel_id": "",
                "tags": "",
            }
        )

        form = rule.get_form_instance()
        assert not form.is_valid()
        assert SLACK_RATE_LIMITED_MESSAGE in str(form.errors.values())

    @responses.activate
    def test_channel_id_provided(self):
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true", "channel": {"name": "my-channel", "id": "C2349874"}}),
        )
        rule = self.get_rule(
            data={
                "workspace": self.integration.id,
                "channel": "#my-channel",
                "input_channel_id": "C2349874",
                "tags": "",
            }
        )

        form = rule.get_form_instance()
        assert form.is_valid()

    @responses.activate
    def test_invalid_channel_id_provided(self):
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": False, "error": "channel_not_found"}),
        )
        rule = self.get_rule(
            data={
                "workspace": self.integration.id,
                "channel": "#my-chanel",
                "input_channel_id": "C1234567",
                "tags": "",
            }
        )

        form = rule.get_form_instance()
        assert not form.is_valid()
        assert "Channel not found. Invalid ID provided." in str(form.errors.values())

    @responses.activate
    def test_invalid_channel_name_provided(self):
        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.info",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true", "channel": {"name": "my-channel", "id": "C2349874"}}),
        )
        rule = self.get_rule(
            data={
                "workspace": self.integration.id,
                "channel": "#my-chanel",
                "input_channel_id": "C1234567",
                "tags": "",
            }
        )

        form = rule.get_form_instance()
        assert not form.is_valid()
        assert (
            "Received channel name my-channel does not match inputted channel name my-chanel."
            in str(form.errors.values())
        )

    def test_invalid_workspace(self):
        # the workspace _should_ be the integration id

        rule = self.get_rule(data={"workspace": "unknown", "channel": "#my-channel", "tags": ""})

        form = rule.get_form_instance()
        assert not form.is_valid()
        assert ["Slack: Workspace is a required field."] in form.errors.values()

    @responses.activate
    def test_display_name_conflict(self):
        rule = self.get_rule(
            data={"workspace": self.integration.id, "channel": "@morty", "tags": ""}
        )

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/conversations.list",
            status=200,
            content_type="application/json",
            body=json.dumps({"ok": "true", "channels": []}),
        )

        members = {
            "ok": "true",
            "members": [
                {"name": "first-morty", "id": "morty-id", "profile": {"display_name": "morty"}},
                {"name": "second-morty", "id": "user-id", "profile": {"display_name": "morty"}},
            ],
        }

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/users.list",
            status=200,
            content_type="application/json",
            body=json.dumps(members),
        )

        form = rule.get_form_instance()
        assert not form.is_valid()
        assert [
            "Slack: Multiple users were found with display name '@morty'. Please use your username, found at sentry.slack.com/account/settings#username."
        ] in form.errors.values()

    def test_disabled_org_integration(self):
        org = self.create_organization(owner=self.user)
        OrganizationIntegration.objects.create(organization_id=org.id, integration=self.integration)
        OrganizationIntegration.objects.filter(
            integration=self.integration, organization=self.event.project.organization
        ).update(status=ObjectStatus.DISABLED)
        event = self.get_event()

        rule = self.get_rule(data={"workspace": self.integration.id, "channel": "#my-channel"})

        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 0

    @responses.activate
    def test_additional_attachment(self):
        manager.attachment_generators[ExternalProviders.SLACK] = additional_attachment_generator
        event = self.get_event()

        rule = self.get_rule(data={"workspace": self.integration.id, "channel": "#my-channel"})

        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 1

        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        # Trigger rule callback
        results[0].callback(event, futures=[])
        data = parse_qs(responses.calls[0].request.body)

        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])

        assert len(attachments) == 2
        assert attachments[0]["title"] == event.title
        assert attachments[1]["title"] == self.organization.slug
        assert attachments[1]["text"] == self.integration.id

    @responses.activate
    def test_multiple_integrations(self):
        org = self.create_organization(owner=self.user)
        OrganizationIntegration.objects.create(organization_id=org.id, integration=self.integration)

        event = self.get_event()

        rule = self.get_rule(data={"workspace": self.integration.id, "channel": "#my-channel"})

        results = list(rule.after(event=event, state=self.get_state()))
        assert len(results) == 1
