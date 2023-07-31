import responses

from sentry.integrations.discord.actions.notification import DiscordNotifyServiceAction
from sentry.integrations.discord.client import DiscordClient
from sentry.integrations.discord.message_builder import LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.base.component import DiscordComponentCustomIds
from sentry.integrations.message_builder import build_attachment_title, build_footer, get_title_link
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.types.integrations import ExternalProviders
from sentry.utils import json


class DiscordIssueAlertTest(RuleTestCase):
    rule_cls = DiscordNotifyServiceAction

    def setUp(self):
        self.guild_id = "guild-id"
        self.channel_id = "channel-id"
        self.discord_user_id = "user1234"
        self.discord_integration = self.create_integration(
            provider="discord",
            name="Cool server",
            external_id=self.guild_id,
            organization=self.organization,
        )
        self.provider = self.create_identity_provider(integration=self.discord_integration)
        self.identity = self.create_identity(
            user=self.user, identity_provider=self.provider, external_id=self.discord_user_id
        )
        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "Event message",
                "timestamp": iso_format(before_now(seconds=1)),
            },
            project_id=self.project.id,
        )

    @responses.activate
    def test_basic(self):
        rule = self.get_rule(
            data={
                "server": self.discord_integration.id,
                "channel_id": self.channel_id,
            }
        )

        results = list(rule.after(self.event, self.get_state()))

        assert len(results) == 1

        responses.add(
            method=responses.POST,
            url=f"{DiscordClient.MESSAGE_URL.format(channel_id=self.channel_id)}",
            status=200,
        )

        results[0].callback(self.event, futures=[])
        body = responses.calls[0].request.body
        data = json.loads(bytes.decode(body, "utf-8"))

        embed = data["embeds"][0]
        assert embed == {
            "title": build_attachment_title(self.event.group),
            "url": get_title_link(
                self.event.group,
                self.event,
                False,
                False,
                None,
                ExternalProviders.DISCORD,
            ),
            "color": LEVEL_TO_COLOR["info"],
            "footer": {"text": build_footer(self.event.group, self.event.project, None, "{text}")},
            "fields": [],
            "timestamp": self.event.timestamp,
        }

        buttons = data["components"][0]["components"]
        assert (
            buttons[0]["custom_id"] == f"{DiscordComponentCustomIds.RESOLVE}:{self.event.group.id}"
        )
        assert (
            buttons[1]["custom_id"] == f"{DiscordComponentCustomIds.ARCHIVE}:{self.event.group.id}"
        )
        assert (
            buttons[2]["custom_id"]
            == f"{DiscordComponentCustomIds.ASSIGN_DIALOG}:{self.event.group.id}"
        )
