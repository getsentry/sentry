from sentry.api.serializers import serialize
from sentry.api.serializers.models.sentry_app import SentryAppSerializer
from sentry.models.avatars.sentry_app_avatar import SentryAppAvatar
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class SentryAppSerializerTest(TestCase):
    def test_published_app(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        sentry_app = self.create_sentry_app(
            name="Tesla App",
            organization=organization,
            published=True,
            scopes=("org:write", "team:admin"),
        )
        result = serialize(sentry_app, None, SentryAppSerializer(), access=None)

        assert result["name"] == "Tesla App"
        assert result["featureData"] == [
            {
                "featureId": 0,
                "description": "Tesla App can **utilize the Sentry API** to pull data or update resources in Sentry (with permissions granted, of course).",
                "featureGate": "integrations-api",
            }
        ]
        assert result["scopes"] == ["org:write", "team:admin"]
        assert result.get("clientSecret") is None

    def test_internal_app(self):
        user = self.create_user()
        org = self.create_organization(owner=user)
        self.create_project(organization=org)
        sentry_app = self.create_internal_integration(
            name="La Croix App", organization=org, scopes=("org:write", "team:admin")
        )
        result = serialize(sentry_app, None, SentryAppSerializer(), access=None)

        assert result["name"] == "La Croix App"
        assert result["status"] == "internal"
        assert result["featureData"] == []
        assert result["scopes"] == ["org:write", "team:admin"]
        assert result.get("clientSecret") is None

    def test_with_avatar(self):
        sentry_app = self.create_sentry_app(
            name="Tesla App", organization=self.organization, published=True, scopes=("org:write",)
        )
        SentryAppAvatar.objects.create(
            sentry_app_id=sentry_app.id,
            avatar_type=1,  # upload
            ident="abc123",
            control_file_id=1,
        )
        result = serialize(sentry_app, None, SentryAppSerializer(), access=None)
        assert "avatars" in result
        assert result["avatars"][0]["avatarUuid"] == "abc123"
        assert result["avatars"][0]["avatarType"] == "upload"
        assert result["avatars"][0]["avatarUrl"] == "http://testserver/sentry-app-avatar/abc123/"
