from __future__ import annotations

from collections.abc import Mapping

from sentry.integrations.models.integration import Integration
from sentry.integrations.notifications import get_integrations_by_channel_by_recipient
from sentry.integrations.services.integration import RpcIntegration
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.integrations.types import ExternalProviders
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.notifications import DummyNotification
from sentry.testutils.silo import control_silo_test
from sentry.types.actor import Actor
from sentry.users.models.user import User


@control_silo_test
class TestNotificationUtilities(TestCase):
    def setUp(self):
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
    ):
        assert actual == {Actor.from_orm_user(k): v for (k, v) in expected.items()}

    def test_simple(self):
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [Actor.from_object(self.user)],
            ExternalProviders.SLACK,
        )

        self._assert_integrations_are(
            integrations_by_channel_by_recipient,
            {self.user: {self.external_user_id_1: self.api_integration}},
        )

    def test_matching_idp_and_identity_external_id(self):
        """
        Test that rows where identity.external_id is equal to idp.external_id are excluded.
        """
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [Actor.from_object(self.user_2)],
            ExternalProviders.SLACK,
        )

        self._assert_integrations_are(integrations_by_channel_by_recipient, {self.user_2: {}})

    def test_multiple(self):
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
