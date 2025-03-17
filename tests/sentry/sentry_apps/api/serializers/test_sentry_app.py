from datetime import datetime, timedelta

from sentry.api.serializers import serialize
from sentry.auth import access
from sentry.sentry_apps.api.serializers.sentry_app import SentryAppSerializer
from sentry.sentry_apps.models.sentry_app_avatar import SentryAppAvatar
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import control_silo_test, no_silo_test


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

    def test_without_optional_fields(self):
        sentry_app = self.create_sentry_app(
            name="Tesla App", organization=self.organization, published=True, scopes=("org:write",)
        )
        sentry_app.author = None
        sentry_app.overview = None
        sentry_app.popularity = None
        sentry_app.redirect_url = None
        sentry_app.webhook_url = None
        sentry_app.date_published = None
        sentry_app.owner = None

        sentry_app.save()
        result = serialize(sentry_app, None, SentryAppSerializer(), access=None)
        assert result.get("author") is None
        assert result.get("overview") is None
        assert result.get("popularity") is None
        assert result.get("redirectUrl") is None
        assert result.get("webhookUrl") is None
        assert result.get("datePublished") is None
        assert result.get("clientSecret") is None
        assert result.get("clientId") is None
        assert result.get("owner") is None


@no_silo_test
class SentryAppHiddenClientSecretSerializerTest(TestCase):
    def test_hidden_client_secret(self):
        sentry_app = self.create_sentry_app(
            name="Tesla App", organization=self.organization, published=True, scopes=("org:write",)
        )

        acc = access.from_user(self.user, self.organization)
        result = serialize(sentry_app, self.user, SentryAppSerializer(), access=acc)
        assert result["clientSecret"] is not None

        now = datetime.now()
        with freeze_time(now + timedelta(hours=25)):
            result = serialize(sentry_app, self.user, SentryAppSerializer(), access=acc)
            assert result["clientSecret"] is None
