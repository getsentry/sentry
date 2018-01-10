from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import User, UserEmail, UserOption
from sentry.testutils import APITestCase


class AccountEmailsIndexTest(APITestCase):
    def test_get_emails(self):
        user = self.create_user(email='foo@example.com')
        UserEmail.objects.create(user=user, email='altemail1@example.com')
        UserEmail.objects.create(user=user, email='altemail2@example.com')
        self.login_as(user)

        url = reverse('sentry-api-0-account-settings-emails-index')
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 3

        primary_email = filter(lambda n: n['isPrimary'], response.data)
        assert len(primary_email) == 1
        assert primary_email[0]['email'] == 'foo@example.com'

        secondary_emails = filter(lambda n: not n['isPrimary'], response.data)
        assert len(secondary_emails) == 2

    def test_change_primary_email(self):
        user = self.create_user(email='foo@example.com')
        self.login_as(user)

        url = reverse('sentry-api-0-account-settings-emails-index')
        UserOption.objects.set_value(user=user, key='alert_email', value='foo@example.com')
        UserOption.objects.set_value(user=user, key='mail:email', value='foo@example.com')

        # invalid email address
        response = self.client.put(url, data={
            'email': 'invalidprimary',
        })
        assert response.status_code == 400

        # same email as current primary
        response = self.client.put(url, data={
            'email': 'foo@example.com',
        })
        assert response.status_code == 400

        # valid primary email
        response = self.client.put(url, data={
            'email': 'newprimary@example.com',
        })
        assert response.status_code == 204

        users = User.objects.filter(email='newprimary@example.com')
        assert len(users) == 1
        assert not len(UserEmail.objects.filter(user=users[0], email='newprimary@example.com'))

        # updated user options
        assert UserOption.objects.get(user=users[0],
                                      key='alert_email').value == 'newprimary@example.com'
        assert UserOption.objects.get(user=users[0],
                                      key='mail:email').value == 'newprimary@example.com'

    def test_add_secondary_email(self):
        user = self.create_user(email='foo@example.com')
        self.login_as(user)

        url = reverse('sentry-api-0-account-settings-emails-index')

        # test invalid email
        response = self.client.post(url, data={
            'email': 'invalidemail',
        })
        assert response.status_code == 400
        assert not len(UserEmail.objects.filter(user=user, email='invalidemail'))

        # valid secondary email
        response = self.client.post(url, data={
            'email': 'altemail1@example.com',
        })

        assert response.status_code == 204
        assert len(UserEmail.objects.filter(user=user, email='altemail1@example.com'))

        # duplicate email
        response = self.client.post(url, data={
            'email': 'altemail1@example.com',
        })
        assert response.status_code == 400

    def test_remove_email(self):
        user = self.create_user(email='foo@example.com')
        UserEmail.objects.create(user=user, email='altemail1@example.com')
        self.login_as(user)

        url = reverse('sentry-api-0-account-settings-emails-index')
        response = self.client.delete(url, data={
            'email': 'altemail1@example.com',
        })
        assert response.status_code == 204
        assert not len(UserEmail.objects.filter(user=user, email='altemail1@example.com'))

    def test_cant_remove_primary_email(self):
        user = self.create_user(email='foo@example.com')
        self.login_as(user)

        url = reverse('sentry-api-0-account-settings-emails-index')
        response = self.client.delete(url, data={
            'email': 'foo@example.com',
        })
        assert response.status_code == 400
        assert len(UserEmail.objects.filter(user=user, email='foo@example.com'))
