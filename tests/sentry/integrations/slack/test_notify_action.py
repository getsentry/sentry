from __future__ import absolute_import

import responses

from six.moves.urllib.parse import parse_qs

from sentry.utils import json
from sentry.models import Integration
from sentry.testutils.cases import RuleTestCase
from sentry.integrations.slack import SlackNotifyServiceAction


class SlackNotifyActionTest(RuleTestCase):
    rule_cls = SlackNotifyServiceAction

    def setUp(self):
        event = self.get_event()

        self.integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX1",
            metadata={"access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        self.integration.add_organization(event.project.organization, self.user)

    def assert_form_valid(self, form, expected_channel_id, expected_channel):
        assert form.is_valid()
        assert form.cleaned_data["channel_id"] == expected_channel_id
        assert form.cleaned_data["channel"] == expected_channel

    @responses.activate
    def test_upgrade_notice_workspace_app(self):
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

        # all workspaces apps should have the upgrade notice
        assert len(attachments) == 2
        assert attachments[1]["title"] == event.title

    @responses.activate
    def test_no_upgrade_notice_bot_app(self):
        self.integration.metadata.update(
            {
                "installation_type": "born_as_bot",
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
            }
        )
        self.integration.save()

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
            data={"workspace": self.integration.id, "channel": "#my-channel", "tags": "one, two"}
        )

        assert (
            rule.render_label()
            == "Send a notification to the Awesome Team Slack workspace to #my-channel and show tags [one, two] in notification"
        )

    def test_render_label_without_integration(self):
        self.integration.delete()

        rule = self.get_rule(
            data={"workspace": self.integration.id, "channel": "#my-channel", "tags": ""}
        )

        label = rule.render_label()
        assert (
            label
            == "Send a notification to the [removed] Slack workspace to #my-channel and show tags [] in notification"
        )

    @responses.activate
    def test_valid_channel_selected(self):
        rule = self.get_rule(
            data={"workspace": self.integration.id, "channel": "#my-channel", "tags": ""}
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
            url="https://slack.com/api/channels.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )

        form = rule.get_form_instance()
        assert form.is_valid()
        self.assert_form_valid(form, "chan-id", "#my-channel")

    @responses.activate
    def test_valid_private_channel_selected(self):
        rule = self.get_rule(
            data={"workspace": self.integration.id, "channel": "#my-private-channel", "tags": ""}
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
            url="https://slack.com/api/channels.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )

        groups = {"ok": "true", "groups": [{"name": "my-private-channel", "id": "chan-id"}]}

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/groups.list",
            status=200,
            content_type="application/json",
            body=json.dumps(groups),
        )

        form = rule.get_form_instance()
        self.assert_form_valid(form, "chan-id", "#my-private-channel")

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
            url="https://slack.com/api/channels.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )

        groups = {"ok": "true", "groups": [{"name": "my-private-channel", "id": "chan-id"}]}

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/groups.list",
            status=200,
            content_type="application/json",
            body=json.dumps(groups),
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
            url="https://slack.com/api/channels.list",
            status=200,
            content_type="application/json",
            body=json.dumps(channels),
        )

        groups = {"ok": "true", "groups": [{"name": "my-private-channel", "id": "chan-id"}]}

        responses.add(
            method=responses.GET,
            url="https://slack.com/api/groups.list",
            status=200,
            content_type="application/json",
            body=json.dumps(groups),
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

    def test_channel_id_provided(self):
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

    def test_invalid_workspace(self):
        # the workspace _should_ be the integration id

        rule = self.get_rule(data={"workspace": "unknown", "channel": "#my-channel", "tags": ""})

        form = rule.get_form_instance()
        assert not form.is_valid()
        assert [u"Slack workspace is a required field."] in form.errors.values()
