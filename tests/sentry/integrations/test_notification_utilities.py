from __future__ import annotations

from collections.abc import Mapping

from sentry.integrations.models.integration import Integration
from sentry.integrations.notifications import get_integrations_by_channel_by_recipient
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.integrations.types import ExternalProviders
from sentry.models.team import Team
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.notifications import DummyNotification
from sentry.testutils.silo import control_silo_test, region_silo_test
from sentry.types.actor import Actor
from sentry.users.models.user import User


@control_silo_test
class TestNotificationUtilities(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.notification = DummyNotification(self.organization)

        self.external_user_id_1 = "UXXXXXXX1"
        self.integration = self.create_slack_integration(self.notification.organization)
        self.api_integration = serialize_integration(self.integration)

        self.user_2 = self.create_user()
        self.external_team_id_2 = "TXXXXXXX2"
        self.integration2 = self.create_slack_integration(
            self.notification.organization,
            external_id=self.external_team_id_2,
            user=self.user_2,
            identity_external_id=self.external_team_id_2,
        )
        self.api_integration2 = serialize_integration(self.integration2)

    def _assert_integrations_are(
        self,
        actual: Mapping[Actor, Mapping[str, RpcIntegration | Integration]],
        expected: Mapping[User, Mapping[str, RpcIntegration | Integration]],
    ) -> None:
        assert actual == {Actor.from_orm_user(k): v for (k, v) in expected.items()}

    def test_simple(self) -> None:
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [Actor.from_object(self.user)],
            ExternalProviders.SLACK,
        )

        self._assert_integrations_are(
            integrations_by_channel_by_recipient,
            {self.user: {self.external_user_id_1: self.api_integration}},
        )

    def test_matching_idp_and_identity_external_id(self) -> None:
        """
        Test that rows where identity.external_id is equal to idp.external_id are excluded.
        """
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [Actor.from_object(self.user_2)],
            ExternalProviders.SLACK,
        )

        self._assert_integrations_are(integrations_by_channel_by_recipient, {self.user_2: {}})

    def test_multiple(self) -> None:
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [Actor.from_object(self.user), Actor.from_object(self.user_2)],
            ExternalProviders.SLACK,
        )

        self._assert_integrations_are(
            integrations_by_channel_by_recipient,
            {
                self.user: {self.external_user_id_1: self.api_integration},
                self.user_2: {},
            },
        )


@region_silo_test
class TestTeamNotificationUtilities(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.notification = DummyNotification(self.organization)
        self.team = self.create_team(organization=self.organization)
        self.integration = self.create_integration(
            organization=self.organization, provider="slack", external_id="TXXXXXXX1"
        )

    def test_team_with_single_external_actor(self) -> None:
        """Test that a team with a single ExternalActor works correctly."""
        external_team_channel_id = "C0123456789"
        self.create_external_team(
            team=self.team,
            integration=self.integration,
            external_name="#test-channel",
            external_id=external_team_channel_id,
            provider=ExternalProviders.SLACK.value,
        )

        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.organization,
            [Actor.from_object(self.team)],
            ExternalProviders.SLACK,
        )

        team_actor = Actor.from_orm_team(self.team)
        assert team_actor in integrations_by_channel_by_recipient
        channels = integrations_by_channel_by_recipient[team_actor]
        assert external_team_channel_id in channels
        assert len(channels) == 1

    def test_team_with_multiple_external_actors(self) -> None:
        """Test that a team with multiple ExternalActor objects for the same provider returns all channels."""
        external_team_channel_id_1 = "C0123456789"
        external_team_channel_id_2 = "C9876543210"

        # Create two external actors for the same team with different channels
        self.create_external_team(
            team=self.team,
            integration=self.integration,
            external_name="#test-channel-1",
            external_id=external_team_channel_id_1,
            provider=ExternalProviders.SLACK.value,
        )

        self.create_external_team(
            team=self.team,
            integration=self.integration,
            external_name="#test-channel-2",
            external_id=external_team_channel_id_2,
            provider=ExternalProviders.SLACK.value,
        )

        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.organization,
            [Actor.from_object(self.team)],
            ExternalProviders.SLACK,
        )

        team_actor = Actor.from_orm_team(self.team)
        assert team_actor in integrations_by_channel_by_recipient
        channels = integrations_by_channel_by_recipient[team_actor]
        assert external_team_channel_id_1 in channels
        assert external_team_channel_id_2 in channels
        assert len(channels) == 2

    def test_team_with_no_external_actors(self) -> None:
        """Test that a team with no ExternalActor returns empty dict."""
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.organization,
            [Actor.from_object(self.team)],
            ExternalProviders.SLACK,
        )

        team_actor = Actor.from_orm_team(self.team)
        assert team_actor in integrations_by_channel_by_recipient
        assert integrations_by_channel_by_recipient[team_actor] == {}
