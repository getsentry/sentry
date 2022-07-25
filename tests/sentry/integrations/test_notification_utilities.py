from sentry.integrations.notifications import get_integrations_by_channel_by_recipient
from sentry.models import Identity, IdentityProvider, IdentityStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.notifications import DummyNotification
from sentry.testutils.helpers.slack import install_slack
from sentry.types.integrations import ExternalProviders


class TestNotificationUtilities(TestCase):
    def setUp(self):
        super().setUp()
        self.notification = DummyNotification(self.organization)

        self.integration = install_slack(self.organization)

        self.idp = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={})
        self.identity = Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=self.idp,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        self.user2 = self.create_user()
        self.idp2 = IdentityProvider.objects.create(
            type="slack", external_id="TXXXXXXX2", config={}
        )
        self.identity2 = Identity.objects.create(
            external_id="TXXXXXXX2",
            idp=self.idp2,
            user=self.user2,
            status=IdentityStatus.VALID,
            scopes=[],
        )

    def test_simple(self):
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [self.user],
            ExternalProviders.SLACK,
        )

        assert {self.user: {"UXXXXXXX1": self.integration}} == integrations_by_channel_by_recipient

    def test_matching_idp_and_identity_external_id(self):
        """
        Test that rows where identity.external_id is equal to idp.external_id are excluded.
        """
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [self.user2],
            ExternalProviders.SLACK,
        )

        assert {self.user2: {}} == integrations_by_channel_by_recipient

    def test_multiple(self):
        integrations_by_channel_by_recipient = get_integrations_by_channel_by_recipient(
            self.notification.organization,
            [self.user, self.user2],
            ExternalProviders.SLACK,
        )

        assert {
            self.user: {"UXXXXXXX1": self.integration},
            self.user2: {},
        } == integrations_by_channel_by_recipient
