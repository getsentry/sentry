from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.conf import settings

from sentry.models import Authenticator
from sentry.testutils import APITestCase


class AuthenticatorIndex(APITestCase):
    def test_simple(self):
        user = self.create_user(email="a@example.com", is_superuser=True)
        Authenticator.objects.create(
            type=3,  # u2f
            user=user,
            config={
                "devices": [
                    {
                        "binding": {
                            "publicKey": u"aowekroawker",
                            "keyHandle": u"aowkeroakewrokaweokrwoer",
                            "appId": u"https://dev.getsentry.net:8000/auth/2fa/u2fappid.json",
                        },
                        "name": u"Amused Beetle",
                        "ts": 1512505334,
                    }
                ]
            },
        )

        self.login_as(user=user, superuser=True)

        url = reverse("sentry-api-0-authenticator-index")

        new_options = settings.SENTRY_OPTIONS.copy()
        new_options["system.url-prefix"] = "https://testserver"
        with self.settings(SENTRY_OPTIONS=new_options):
            resp = self.client.get(url, format="json")

            assert resp.status_code == 200, (resp.status_code, resp.content)
            assert resp.data
            assert resp.data[0]["challenge"]
            assert resp.data[0]["id"] == "u2f"
