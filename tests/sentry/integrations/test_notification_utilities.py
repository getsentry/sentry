from sentry.integrations.notifications import get_integrations_by_channel_by_recipient
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.notifications import DummyNotification
from sentry.types.integrations import ExternalProviders


class TestNotificationUtilities(TestCase):
    def setUp(self):
        super().setUp()
        self.notification = DummyNotification(self.organization)

        self.external_user_id_1 = "UXXXXXXX1"
        self.integration = self.create_slack_integration(self.notification.organization)
        self.api_integration = integration_service._serialize_integration(self.integration)

        self.user_2 = self.create_user()
        self.external_team_id_2 = "TXXXXXXX2"
        self.integration2 = self.create_slack_integration(
            self.notification.organization,
            external_id=self.external_team_id_2,
            user=self.user_2,
            identity_external_id=self.external_team_id_2,
        )
        self.api_integration2 = integration_service._serialize_integration(self.integration2)

    def test_simple(self):
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [self.user],
            ExternalProviders.SLACK,
        )

        assert {
            self.user: {self.external_user_id_1: self.api_integration}
        } == integrations_by_channel_by_recipient

    def test_matching_idp_and_identity_external_id(self):
        """
        Test that rows where identity.external_id is equal to idp.external_id are excluded.
        """
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [self.user_2],
            ExternalProviders.SLACK,
        )

        assert {self.user_2: {}} == integrations_by_channel_by_recipient

    def test_multiple(self):
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [self.user, self.user_2],
            ExternalProviders.SLACK,
        )

        assert {
            self.user: {self.external_user_id_1: self.api_integration},
            self.user_2: {},
        } == integrations_by_channel_by_recipient
