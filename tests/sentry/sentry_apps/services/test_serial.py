from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.sentry_apps.services.app.serial import serialize_sentry_app
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of, control_silo_test


@control_silo_test
class SerializeSentryAppTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(email="creator@example.com")
        self.org = self.create_organization(owner=self.user, slug="my-org")
        self.sentry_app = self.create_sentry_app(
            name="Test App",
            organization=self.org,
            user=self.user,
            webhook_url="https://example.com/webhook",
        )

    def test_populates_creator_label(self) -> None:
        with assume_test_silo_mode_of(SentryApp):
            rpc = serialize_sentry_app(self.sentry_app)

        assert rpc.creator_label == "creator@example.com"
        assert rpc.owner_id == self.org.id

    def test_creator_label_falls_back_to_username_when_no_email(self) -> None:
        userless_email = self.create_user(email="", username="someusername")
        with assume_test_silo_mode_of(SentryApp):
            app = self.create_sentry_app(
                name="No Email App",
                organization=self.org,
                user=userless_email,
            )
            rpc = serialize_sentry_app(app)

        assert rpc.creator_label == "someusername"
