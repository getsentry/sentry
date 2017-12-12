from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import TestCase


class AccountSettingsTest(TestCase):
    def test_settings_renders_with_verify_new_password(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        path = reverse('sentry-account-settings')
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/settings.html')
        form = resp.context['form']
        assert form.errors == {}
        for field in ('name', 'email', 'new_password', 'verify_new_password', 'password'):
            assert field in form.fields

        self.assertContains(resp, 'New password')
        self.assertContains(resp, 'Verify new password')

    def test_settings_renders_without_verify_new_password(self):
        user = self.create_user('foo@example.com')
        user.update(is_managed=True)
        self.login_as(user)
        path = reverse('sentry-account-settings')
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/settings.html')
        import pdb
        pdb.set_trace()
        form = resp.context['form']
        assert form.errors == {}
        for field in ('name', 'email', 'new_password', 'verify_new_password', 'password'):
            assert field in form.fields

        self.assertContains(resp, 'New password')
        self.assertContains(resp, 'Verify new password')
