from datetime import timedelta
from unittest import mock

from sentry.api.serializers import serialize
from sentry.api.serializers.models.user_identity_config import Status, UserIdentityConfig
from sentry.models import AuthIdentity, AuthProvider, Identity, IdentityProvider
from sentry.testutils import TestCase
from social_auth.models import UserSocialAuth


class UserIdentityConfigSerializerTest(TestCase):
    def setUp(self) -> None:
        self.user = self.create_user()

        self.idp = IdentityProvider.objects.create(type="github", external_id="c3r1zyq9", config={})

    def test_user_social_auth(self):
        identity = UserSocialAuth.objects.create(user=self.user, provider="github", uid="uf4romdj")
        view = UserIdentityConfig.wrap(identity, Status.CAN_DISCONNECT)
        result = serialize(view)

        assert result == {
            "category": "social-identity",
            "id": str(identity.id),
            "provider": {"key": "github", "name": "GitHub"},
            "name": "uf4romdj",
            "status": "can_disconnect",
            "isLogin": False,
            "organization": None,
            "dateAdded": None,
            "dateVerified": None,
            "dateSynced": None,
        }

    def test_global_identity(self):
        identity = Identity.objects.create(idp=self.idp, user=self.user, external_id="bk1zbu82")
        identity.date_verified += timedelta(hours=1)
        identity.save()

        view = UserIdentityConfig.wrap(identity, Status.CAN_DISCONNECT)
        result = serialize(view)

        assert result == {
            "category": "global-identity",
            "id": str(identity.id),
            "provider": {"key": "github", "name": "GitHub"},
            "name": "bk1zbu82",
            "status": "can_disconnect",
            "isLogin": False,
            "organization": None,
            "dateAdded": identity.date_added,
            "dateVerified": identity.date_verified,
            "dateSynced": None,
        }

    @mock.patch("sentry.api.serializers.models.user_identity_config.is_login_provider")
    def test_global_login_identity(self, mock_is_login_provider):
        mock_is_login_provider.return_value = True

        identity = Identity.objects.create(idp=self.idp, user=self.user, external_id="m9p8bzua")
        identity.date_verified += timedelta(hours=1)
        identity.save()

        view = UserIdentityConfig.wrap(identity, Status.NEEDED_FOR_GLOBAL_AUTH)
        result = serialize(view)

        assert result == {
            "category": "global-identity",
            "id": str(identity.id),
            "provider": {"key": "github", "name": "GitHub"},
            "name": "m9p8bzua",
            "status": "needed_for_global_auth",
            "isLogin": True,
            "organization": None,
            "dateAdded": identity.date_added,
            "dateVerified": identity.date_verified,
            "dateSynced": None,
        }

    def test_auth_identity(self):
        org = self.create_organization()
        provider = AuthProvider.objects.create(organization=org, provider="dummy")

        identity = AuthIdentity.objects.create(
            user=self.user, auth_provider=provider, ident="hhyjzna1"
        )
        identity.last_verified += timedelta(hours=1)
        identity.last_synced += timedelta(hours=2)
        identity.save()

        view = UserIdentityConfig.wrap(identity, Status.NEEDED_FOR_ORG_AUTH)
        result = serialize(view)

        org_serial = result.pop("organization")
        assert org_serial["id"] == str(org.id)
        assert org_serial["slug"] == org.slug

        assert result == {
            "category": "org-identity",
            "id": str(identity.id),
            "provider": {"key": "dummy", "name": "Dummy"},
            "name": "hhyjzna1",
            "status": "needed_for_org_auth",
            "isLogin": True,
            "dateAdded": identity.date_added,
            "dateVerified": identity.last_verified,
            "dateSynced": identity.last_synced,
        }

    def test_global_identity_with_integration_provider(self):
        integration_provider = IdentityProvider.objects.create(
            type="msteams", external_id="ao645i51", config={}
        )
        identity = Identity.objects.create(
            idp=integration_provider, user=self.user, external_id="5ppj2dip"
        )
        view = UserIdentityConfig.wrap(identity, Status.CAN_DISCONNECT)
        result = serialize(view)

        assert result["provider"] == {"key": "msteams", "name": "Microsoft Teams"}
