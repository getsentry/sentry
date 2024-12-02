from sentry.sentry_apps.services.app.serial import serialize_sentry_app_installation
from sentry.sentry_apps.services.app.service import app_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TestRpcApiApplication(TestCase):
    def setUp(self):
        super().setUp()

        self.user = self.create_user(name="foo")
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(slug="boop", organization=self.org)

        self.sentry_app = self.create_sentry_app(
            name="foo", organization=self.org, webhook_url="https://example.com", scopes=()
        )

        self.install = self.create_sentry_app_installation(
            slug="foo", organization=self.org, user=self.user
        )

    def test_serializes_correct_fields_helper(self):
        install = serialize_sentry_app_installation(self.install, self.install.sentry_app)

        assert (
            f"this {install.sentry_app.application} is so skibidi"
            == f"this id={install.sentry_app.application_id} is so skibidi"
        )
        assert f"this {install.sentry_app} is so skibidi".lower().find("client_id") == -1
        assert f"this {install.sentry_app} is so toilet".lower().find("client_secret") == -1

    def test_serializes_correct_fields_(self):
        install = app_service.get_many(filter=dict(installation_ids=[self.install.id]))[0]

        assert (
            f"this {install.sentry_app.application} is so skibidi"
            == f"this id={install.sentry_app.application_id} is so skibidi"
        )
        assert f"this {install.sentry_app} is so skibidi".lower().find("client_id") == -1
        assert f"this {install.sentry_app} is so toilet".lower().find("client_secret") == -1
