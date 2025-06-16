from sentry.sentry_apps.services.app.serial import (
    serialize_sentry_app_avatar,
    serialize_sentry_app_installation,
)
from sentry.sentry_apps.services.app.service import app_service
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test, region_silo_test


@control_silo_test
class TestSentryAppAvatar(TestCase):
    def setUp(self):
        super().setUp()
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.avatar = self.create_sentry_app_avatar(sentry_app=self.sentry_app)

    def test_rpc_avatar_properties(self):
        rpc_avatar = serialize_sentry_app_avatar(self.avatar)
        assert rpc_avatar.id == self.avatar.id
        assert rpc_avatar.ident == self.avatar.ident
        assert rpc_avatar.sentry_app_id == self.avatar.sentry_app_id
        assert rpc_avatar.avatar_type == self.avatar.avatar_type
        assert rpc_avatar.color == self.avatar.color
        assert rpc_avatar.AVATAR_TYPES == self.avatar.AVATAR_TYPES
        assert rpc_avatar.url_path == self.avatar.url_path
        assert rpc_avatar.FILE_TYPE == self.avatar.FILE_TYPE
        assert rpc_avatar.get_avatar_type_display() == self.avatar.get_avatar_type_display()
        assert rpc_avatar.get_cache_key(20) == self.avatar.get_cache_key(20)
        assert rpc_avatar.get_avatar_photo_type() == self.avatar.get_avatar_photo_type()
        assert rpc_avatar.absolute_url() == self.avatar.absolute_url()


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
