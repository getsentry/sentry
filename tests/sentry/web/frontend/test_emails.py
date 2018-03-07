from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import TestCase
from sentry.models import User, UserEmail


class EmailsTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry-account-settings-emails')

    def test_render_emails(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        self.assertTemplateUsed('sentry/account/settings/emails.html')
        assert 'primary_email' in resp.context
        self.assertIn('foo@example.com', resp.content)

    def test_show_alt_emails(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        email = UserEmail(user=user, email='bar@example.com')
        email.save()
        resp = self.client.get(self.path)
        self.assertIn('bar@example.com', resp.content)
        assert 'bar@example.com' in ([thing.email for thing in user.emails.all()])

    def test_create_alt_email_with_password(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        user.set_password('something')
        user.save()
        resp = self.client.post(
            self.path, data={'alt_email': 'hello@gmail.com',
                             'password': 'something'}, follow=True
        )
        assert resp.status_code == 200
        self.assertIn('hello@gmail.com', resp.content)
        emails = UserEmail.objects.filter(user=user)
        assert 'hello@gmail.com' in ([email.email for email in emails])

    def test_fail_to_create_email_without_pw(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        user.set_password('something')
        user.save()
        resp = self.client.post(
            self.path, data={
                'alt_email': 'hello@gmail.com',
            }, follow=True
        )
        assert resp.status_code == 200
        self.assertIn('This field is required', resp.content)
        emails = UserEmail.objects.filter(user=user)
        assert 'hello@gmail.com' not in ([email.email for email in emails])

    def test_create_alt_email_without_usable_pw(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        user.set_unusable_password()
        user.save()
        resp = self.client.post(
            self.path, data={
                'alt_email': 'hello@gmail.com',
            }, follow=True
        )
        assert resp.status_code == 200
        self.assertIn('hello@gmail.com', resp.content)
        emails = UserEmail.objects.filter(user=user)
        assert 'hello@gmail.com' in ([email.email for email in emails])

    def test_remove_alt_email(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        email = UserEmail(user=user, email='bar@example.com')
        email.save()
        resp = self.client.get(self.path)
        self.assertIn('bar@example.com', resp.content)
        resp = self.client.post(
            self.path, data={'remove': '',
                             'email': 'bar@example.com'}, follow=True
        )
        self.assertNotIn('bar@example.com', resp.content)
        assert 'bar@example.com' not in (email.email for email in user.emails.all())

    def test_change_verified_primary_email(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        resp = self.client.get(self.path)
        self.assertIn('foo@example.com', resp.content)
        UserEmail.objects.create(email='bar@example.com', is_verified=True, user=user)
        resp = self.client.post(
            self.path, {'primary': '',
                        'new_primary_email': 'bar@example.com'}, follow=True
        )
        self.assertIn('bar@example.com', resp.content)
        user = User.objects.get(id=user.id)
        assert user.email == 'bar@example.com'
        assert user.username == 'bar@example.com'

    def test_change_unverified_primary_email(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        resp = self.client.get(self.path)
        self.assertIn('foo@example.com', resp.content)
        UserEmail.objects.create(email='bar@example.com', is_verified=False, user=user)
        resp = self.client.post(
            self.path, {'primary': '',
                        'new_primary_email': 'bar@example.com'}, follow=True
        )
        user = User.objects.get(id=user.id)
        assert user.email == 'foo@example.com'
        assert user.username == 'foo@example.com'
