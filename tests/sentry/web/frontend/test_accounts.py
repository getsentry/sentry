from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import LostPasswordHash
from sentry.testutils import TestCase


class TestAccounts(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-account-recover")

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
