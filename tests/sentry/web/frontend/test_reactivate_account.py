from functools import cached_property

from django.urls import reverse

from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class ReactivateAccountTest(TestCase):
    @cached_property
    def path(self) -> str:
        return reverse("sentry-reactivate-account")

    def test_renders(self) -> None:
        user = self.create_user("foo@example.com", is_active=False)

        self.login_as(user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, "sentry/reactivate-account.html")

    def test_does_reactivate(self) -> None:
        user = self.create_user("foo@example.com", is_active=False)

        self.login_as(user)

        resp = self.client.post(self.path, data={"op": "confirm"})
        assert resp.status_code == 302

    def test_suspended_user_cannot_reactivate(self) -> None:
        user = self.create_user("suspended@example.com", is_active=False, is_suspended=True)

        self.login_as(user)

        # Suspended users are rejected by EmailAuthBackend.get_user(), so
        # Django's auth middleware treats the session as unauthenticated and
        # the view redirects to login.
        resp = self.client.post(self.path, data={"op": "confirm"})
        assert resp.status_code == 302

        from sentry.users.models.user import User

        user = User.objects.get(id=user.id)
        assert not user.is_active
