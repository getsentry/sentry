from functools import cached_property

from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ReactivateAccountTest(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-reactivate-account")

    def test_renders(self):
        user = self.create_user("foo@example.com", is_active=False)

        self.login_as(user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/reactivate-account.html")

    def test_does_reactivate(self):
        user = self.create_user("foo@example.com", is_active=False)

        self.login_as(user)

        resp = self.client.post(self.path, data={"op": "confirm"})
        assert resp.status_code == 302
