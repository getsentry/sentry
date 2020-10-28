from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.conf import settings

from sentry.testutils import APITestCase


class SudoTest(APITestCase):
    def test_sudo_required_del_org(self):
        org = self.create_organization()
        url = reverse("sentry-api-0-organization-details", kwargs={"organization_slug": org.slug})

        user = self.create_user(email="foo@example.com")
        self.create_member(organization=org, user=user, role="owner")

        self.login_as(user)

        middleware = list(settings.MIDDLEWARE_CLASSES)
        index = middleware.index("sentry.testutils.middleware.SudoMiddleware")
        middleware[index] = "sentry.middleware.sudo.SudoMiddleware"

        with self.settings(MIDDLEWARE_CLASSES=tuple(middleware)):
            response = self.client.delete(url, is_sudo=False)
            assert response.status_code == 401
            assert response.data["detail"]["code"] == "sudo-required"
            assert response.data["detail"]["message"] == "Account verification required."
            assert response.data["detail"]["extra"]["username"] == "foo@example.com"

            sudo_url = reverse("sentry-api-0-auth", kwargs={})
            # Now try to gain sudo access
            response = self.client.post(
                sudo_url, {"username": "foo@example.com", "password": "admin"}
            )
            assert response.status_code == 200

            # This should now work
            response = self.client.delete(url, is_sudo=False)
            assert response.status_code == 202
