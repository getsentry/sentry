from __future__ import annotations

from typing import Any
from unittest import mock
from unittest.mock import patch

from sentry.integrations.discord.message_builder.base.component import (
    DiscordComponentCustomIds as CustomIds,
)
from sentry.integrations.discord.requests.base import (
    DiscordMessageComponentTypes,
    DiscordRequestTypes,
)
from sentry.integrations.discord.webhooks.message_component import (
    ARCHIVE_UNTIL_ESCALATES,
    ASSIGNEE_UPDATED,
    INVALID_GROUP_ID,
    MARKED_ONGOING,
    NO_IDENTITY,
    NOT_IN_ORG,
    RESOLVE_DIALOG_OPTIONS,
    RESOLVED,
    RESOLVED_IN_CURRENT_RELEASE,
    RESOLVED_IN_NEXT_RELEASE,
    UNRESOLVED,
)
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.release import Release
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_slo_metric
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode

WEBHOOK_URL = "/extensions/discord/interactions/"


class DiscordMessageComponentInteractionTest(APITestCase):
    def setUp(self):
        patcher = mock.patch(
            "sentry.integrations.discord.requests.base.verify_signature", return_value=True
        )
        patcher.start()

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
        self.create_identity(
            user=self.user, identity_provider=self.provider, external_id=self.discord_user_id
        )

    def send_interaction(self, data: Any | None = None, member: Any | None = None):
        if data is None:
            data = {"custom_id": f"unknown:{self.group.id}"}
        if member is None:
            member = {"user": {"id": self.discord_user_id}}

        return self.client.post(
            path=WEBHOOK_URL,
            data={
                "type": DiscordRequestTypes.MESSAGE_COMPONENT,
                "guild_id": self.guild_id,
                "channel_id": self.channel_id,
                "data": data,
                "member": member,
            },
            format="json",
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )

    def get_message_content(self, response: Any) -> str:
        return response.json()["data"]["content"]

    def get_message_components(self, response: Any) -> Any:
        return response.json()["data"]["components"]

    def get_select_options(self, response: Any) -> Any:
        return self.get_message_components(response)[0]["components"][0]["options"]

    def test_unknown_custom_id_interaction(self):
        response = self.send_interaction({"custom_id": f"unknown:{self.group.id}"})
        assert response.status_code == 200
        assert self.get_message_content(response) == INVALID_GROUP_ID

    def test_empty_custom_id_interaction(self):
        response = self.send_interaction({"custom_id": ""})
        assert response.status_code == 200
        assert self.get_message_content(response) == INVALID_GROUP_ID

    def test_no_user(self):
        response = self.send_interaction(member={"user": {"id": "not-our-user"}})
        assert response.status_code == 200
        assert self.get_message_content(response) == NO_IDENTITY

    def test_no_guild_id(self):
        response = self.client.post(
            path=WEBHOOK_URL,
            data={
                "type": DiscordRequestTypes.MESSAGE_COMPONENT,
            },
            format="json",
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == NO_IDENTITY

    def test_invalid_guild_id(self):
        response = self.client.post(
            path=WEBHOOK_URL,
            data={
                "type": DiscordRequestTypes.MESSAGE_COMPONENT,
                "guild_id": "invalid_guild_id",
            },
            format="json",
            HTTP_X_SIGNATURE_ED25519="signature",
            HTTP_X_SIGNATURE_TIMESTAMP="timestamp",
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == NO_IDENTITY

    def test_not_in_org(self):
        other_user = self.create_user()
        other_user_discord_id = "other-user1234"
        other_org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.discord_integration.add_organization(other_org)
        self.create_identity(
            user=other_user, identity_provider=self.provider, external_id=other_user_discord_id
        )

        response = self.send_interaction(member={"user": {"id": other_user_discord_id}})

        assert response.status_code == 200
        assert self.get_message_content(response) == NOT_IN_ORG

    def test_assign_dialog(self):
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.BUTTON,
                "custom_id": f"{CustomIds.ASSIGN_DIALOG}:{self.group.id}",
            }
        )
        assert response.status_code == 200
        assert self.get_select_options(response) == [
            {"label": f"#{self.team.slug}", "value": f"team:{self.team.id}", "default": False},
            {"label": self.user.email, "value": f"user:{self.user.id}", "default": False},
        ]

    def test_assign_dialog_invalid_group_id(self):
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.BUTTON,
                "custom_id": f"{CustomIds.ASSIGN_DIALOG}:invalid",
            }
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == INVALID_GROUP_ID

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_assign(self, mock_record):
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.SELECT,
                "custom_id": f"{CustomIds.ASSIGN}:{self.group.id}",
                "values": [f"user:{self.user.id}"],
            }
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == ASSIGNEE_UPDATED

        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    def test_resolve_dialog(self):
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.BUTTON,
                "custom_id": f"{CustomIds.RESOLVE_DIALOG}:{self.group.id}",
            }
        )
        assert response.status_code == 200
        assert self.get_select_options(response) == [
            option.build() for option in RESOLVE_DIALOG_OPTIONS
        ]

    def test_resolve_non_dialog(self):
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.BUTTON,
                "custom_id": f"{CustomIds.RESOLVE}:{self.group.id}",
            }
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == RESOLVED

    def test_resolve_now_from_dialog(self):
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.SELECT,
                "custom_id": f"{CustomIds.RESOLVE}:{self.group.id}",
                "values": [""],
            }
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == RESOLVED

    def test_resolve_in_next_release(self):
        release = Release.objects.create(
            organization_id=self.organization.id,
            version="1.0",
        )
        release.add_project(self.project)
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.SELECT,
                "custom_id": f"{CustomIds.RESOLVE}:{self.group.id}",
                "values": ["inNextRelease"],
            }
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == RESOLVED_IN_NEXT_RELEASE

    def test_resolve_in_current_release(self):
        release = Release.objects.create(
            organization_id=self.organization.id,
            version="1.0",
        )
        release.add_project(self.project)
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.SELECT,
                "custom_id": f"{CustomIds.RESOLVE}:{self.group.id}",
                "values": ["inCurrentRelease"],
            }
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == RESOLVED_IN_CURRENT_RELEASE

    def test_unresolve(self):
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.BUTTON,
                "custom_id": f"{CustomIds.UNRESOLVE}:{self.group.id}",
            }
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == UNRESOLVED

    def test_mark_ongoing(self):
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.BUTTON,
                "custom_id": f"{CustomIds.MARK_ONGOING}:{self.group.id}",
            }
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == MARKED_ONGOING

    def test_archive(self):
        response = self.send_interaction(
            {
                "component_type": DiscordMessageComponentTypes.BUTTON,
                "custom_id": f"{CustomIds.ARCHIVE}:{self.group.id}",
            }
        )
        assert response.status_code == 200
        assert self.get_message_content(response) == ARCHIVE_UNTIL_ESCALATES
