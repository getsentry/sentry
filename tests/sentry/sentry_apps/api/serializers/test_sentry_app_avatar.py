from sentry.api.serializers import serialize
from sentry.sentry_apps.api.serializers.sentry_app_avatar import SentryAppAvatarSerializer
from sentry.sentry_apps.services.app.serial import serialize_sentry_app_avatar
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SentryAppSerializerTest(TestCase):
    def setUp(self):
        self.sentry_app = self.create_sentry_app(organization=self.organization)
        self.avatar = self.create_sentry_app_avatar(sentry_app=self.sentry_app)

    def test_avatar(self):
        serial_avatar = serialize(self.avatar, None)
        assert serial_avatar["avatarType"] == self.avatar.get_avatar_type_display()
        assert serial_avatar["avatarUuid"] == self.avatar.ident
        assert serial_avatar["avatarUrl"] == self.avatar.absolute_url()
        assert serial_avatar["color"] == self.avatar.color
        assert serial_avatar["photoType"] == self.avatar.get_avatar_photo_type().value

    def test_rpc_avatar(self):
        rpc_avatar = serialize_sentry_app_avatar(self.avatar)
        serial_rpc_avatar = serialize(rpc_avatar, None, SentryAppAvatarSerializer())
        assert serial_rpc_avatar["avatarType"] == self.avatar.get_avatar_type_display()
        assert serial_rpc_avatar["avatarUuid"] == self.avatar.ident
        assert serial_rpc_avatar["avatarUrl"] == self.avatar.absolute_url()
        assert serial_rpc_avatar["color"] == self.avatar.color
        assert serial_rpc_avatar["photoType"] == self.avatar.get_avatar_photo_type().value
