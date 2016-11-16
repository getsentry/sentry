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
        assert 'alt_emails' in resp.context
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
        resp = self.client.post(self.path, data={
            'primary_email': user.email,
            'alt_email': 'hello@gmail.com',
            'password': 'something'},
            follow=True
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
        resp = self.client.post(self.path, data={
            'primary_email': user.email,
            'alt_email': 'hello@gmail.com'},
            follow=True
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
        resp = self.client.post(self.path, data={
            'primary_email': user.email,
            'alt_email': 'hello@gmail.com'
        },
            follow=True
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
        resp = self.client.post(self.path, data={'remove': '', 'email': 'bar@example.com'}, follow=True)
        self.assertNotIn('bar@example.com', resp.content)
        assert 'bar@example.com' not in (email.email for email in user.emails.all())

    def test_change_primary_email(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        user.set_password('something')
        user.save()
        resp = self.client.get(self.path)
        self.assertIn('foo@example.com', resp.content)
        resp = self.client.post(self.path,
            {'primary_email': 'bar@example.com',
             'password': 'something'},
            follow=True
        )
        self.assertIn('bar@example.com', resp.content)
        user = User.objects.get(id=user.id)
        assert user.email != 'foo@example.com'
        assert user.email == 'bar@example.com'
