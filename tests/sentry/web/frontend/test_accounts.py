from functools import cached_property

from django.test import override_settings
from django.urls import reverse

from sentry.models.lostpasswordhash import LostPasswordHash
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test(stable=True)
class TestAccounts(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-account-recover")

    def password_recover_path(self, user_id, hash_):
        return reverse("sentry-account-recover-confirm", kwargs={"user_id": user_id, "hash": hash_})

    def test_get_renders_form(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/account/recover/index.html")

    def test_post_unknown_user(self):
        resp = self.client.post(self.path, {"user": "nobody"})
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/account/recover/sent.html")
        assert 0 == len(LostPasswordHash.objects.all())

    def test_post_success(self):
        user = self.create_user()

        resp = self.client.post(self.path, {"user": user.email})
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/account/recover/sent.html")
        assert 1 == len(LostPasswordHash.objects.all())

    def test_post_managed_user(self):
        user = self.create_user()
        user.is_managed = True
        user.save()

        resp = self.client.post(self.path, {"user": user.email})
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/account/recover/index.html")
        self.assertContains(resp, "The account you are trying to recover is managed")
        assert 0 == len(LostPasswordHash.objects.all())

    def test_post_multiple_users(self):
        user = self.create_user(email="bob")
        user.email = "bob@example.com"
        user.save()

        user_dup = self.create_user(email="jill")
        user_dup.email = user.email
        user_dup.save()

        resp = self.client.post(self.path, {"user": user.email})
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/account/recover/index.html")
        assert 0 == len(LostPasswordHash.objects.all())

    def test_leaking_recovery_hash(self):
        user = self.create_user()

        resp = self.client.post(self.path, {"user": user.email})
        assert resp.status_code == 200

        lost_password = LostPasswordHash.objects.get(user=user)

        resp = self.client.post(
            self.password_recover_path(lost_password.user_id, lost_password.hash),
            {"password": "test_password"},
        )

        header_name = "Referrer-Policy"

        assert resp.has_header(header_name)
        assert resp[header_name] == "strict-origin-when-cross-origin"

    @override_settings(
        AUTH_PASSWORD_VALIDATORS=[
            {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"}
        ]
    )
    def test_unable_to_set_weak_password_via_recover_form(self):
        lost_password = LostPasswordHash.objects.create(user=self.user)

        resp = self.client.post(
            self.password_recover_path(lost_password.user_id, lost_password.hash),
            data={"user": self.user.email, "password": self.user.email},
        )
        assert resp.status_code == 200
        assert b"The password is too similar to the username." in resp.content
