from functools import cached_property
from unittest.mock import patch

from django.test import override_settings
from django.urls import reverse

from sentry.models.lostpasswordhash import LostPasswordHash
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class TestAccounts(TestCase):
    @cached_property
    def path(self):
        return reverse("sentry-account-recover")

    def password_recover_path(self, user_id, hash_):
        return reverse("sentry-account-recover-confirm", kwargs={"user_id": user_id, "hash": hash_})

    def relocation_recover_path(self, user_id, hash_):
        return reverse(
            "sentry-account-relocate-confirm", kwargs={"user_id": user_id, "hash": hash_}
        )

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

    def test_relocate_recovery_no_inputs(self):
        user = self.create_user()

        resp = self.client.post(self.path, {"user": user.email})
        assert resp.status_code == 200

        lost_password = LostPasswordHash.objects.get(user=user)

        resp = self.client.get(
            self.relocation_recover_path(lost_password.user_id, lost_password.hash),
        )

        header_name = "Referrer-Policy"

        assert resp.has_header(header_name)
        assert resp.templates[0].name == ("sentry/account/relocate/confirm.html")
        assert resp.status_code == 200
        assert resp[header_name] == "strict-origin-when-cross-origin"

    def test_relocate_recovery_post(self):
        user = self.create_user()

        resp = self.client.post(self.path, {"user": user.email})
        assert resp.status_code == 200

        lost_password = LostPasswordHash.objects.get(user=user)
        user.is_unclaimed = True
        user.save()
        old_password = user.password
        new_username = "test_username"

        resp = self.client.post(
            self.relocation_recover_path(lost_password.user_id, lost_password.hash),
            {"username": new_username, "password": "test_password"},
        )

        header_name = "Referrer-Policy"

        user.refresh_from_db()
        assert resp.has_header(header_name)
        assert resp.templates[0].name == ("sentry/emails/password-changed.txt")
        assert not user.is_unclaimed
        assert user.username == new_username
        assert user.password != old_password
        assert resp.status_code == 302
        assert resp[header_name] == "strict-origin-when-cross-origin"

    def test_relocate_recovery_invalid_password(self):
        user = self.create_user()

        resp = self.client.post(self.path, {"user": user.email})
        assert resp.status_code == 200

        lost_password = LostPasswordHash.objects.get(user=user)
        user.is_unclaimed = True
        user.save()
        old_password = user.password
        new_username = "test_username"

        with patch.object(lost_password, "is_valid", return_value=False):
            with patch.object(LostPasswordHash.objects, "get", return_value=lost_password):
                resp = self.client.post(
                    self.relocation_recover_path(lost_password.user_id, lost_password.hash),
                    {"username": new_username, "password": "test_password123"},
                )

                header_name = "Referrer-Policy"

                user.refresh_from_db()
                assert resp.has_header(header_name)
                assert resp.templates[0].name == ("sentry/account/relocate/failure.html")
                assert user.is_unclaimed
                assert user.username != new_username
                assert user.password == old_password
                assert resp.status_code == 200
                assert resp[header_name] == "strict-origin-when-cross-origin"
