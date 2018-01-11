from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import User, UserEmail, UserOption
from sentry.testutils import APITestCase


class UserEmailsTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='foo@example.com')
        self.login_as(user=self.user)
        self.url = reverse('sentry-api-0-user-emails', kwargs={'user_id': self.user.id})

    def test_get_emails(self):
        UserEmail.objects.create(user=self.user, email='altemail1@example.com')
        UserEmail.objects.create(user=self.user, email='altemail2@example.com')

        response = self.client.get(self.url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 3

        primary_email = filter(lambda n: n['isPrimary'], response.data)
        assert len(primary_email) == 1
        assert primary_email[0]['email'] == 'foo@example.com'

        secondary_emails = filter(lambda n: not n['isPrimary'], response.data)
        assert len(secondary_emails) == 2

    def test_add_new_primary_email(self):
        UserOption.objects.set_value(user=self.user, key='alert_email', value='foo@example.com')
        UserOption.objects.set_value(user=self.user, key='mail:email', value='foo@example.com')

        # invalid email address
        response = self.client.put(self.url, data={
            'email': 'invalidprimary',
        })
        assert response.status_code == 400

        # same email as current primary
        response = self.client.put(self.url, data={
            'email': 'foo@example.com',
        })
        assert response.status_code == 400

        # valid primary email
        response = self.client.put(self.url, data={
            'email': 'newprimary@example.com',
        })
        assert response.status_code == 204

        users = User.objects.filter(email='newprimary@example.com')
        assert len(users) == 1
        assert UserEmail.objects.filter(user=users[0], email='newprimary@example.com').exists()

        # updated user options
        assert UserOption.objects.get(user=users[0],
                                      key='alert_email').value == 'newprimary@example.com'
        assert UserOption.objects.get(user=users[0],
                                      key='mail:email').value == 'newprimary@example.com'

    def test_add_secondary_email(self):
        # test invalid email
        response = self.client.post(self.url, data={
            'email': 'invalidemail',
        })
        assert response.status_code == 400
        assert not len(UserEmail.objects.filter(user=self.user, email='invalidemail'))

        # valid secondary email
        response = self.client.post(self.url, data={
            'email': 'altemail1@example.com',
        })

        assert response.status_code == 204
        assert len(UserEmail.objects.filter(user=self.user, email='altemail1@example.com'))

        # duplicate email
        response = self.client.post(self.url, data={
            'email': 'altemail1@example.com',
        })
        assert response.status_code == 400

    def test_change_secondary_to_primary(self):
        # valid secondary email
        response = self.client.post(self.url, data={
            'email': 'altemail1@example.com',
        })
        assert response.status_code == 204
        assert len(UserEmail.objects.filter(user=self.user, email='altemail1@example.com'))

        # duplicate email
        response = self.client.put(self.url, data={
            'email': 'altemail1@example.com',
        })
        assert response.status_code == 204

        user = User.objects.get(id=self.user.id)
        assert user.email == 'altemail1@example.com'
        assert user.username == 'altemail1@example.com'

    def test_remove_email(self):
        UserEmail.objects.create(user=self.user, email='altemail1@example.com')

        response = self.client.delete(self.url, data={
            'email': 'altemail1@example.com',
        })
        assert response.status_code == 204
        assert not len(UserEmail.objects.filter(user=self.user, email='altemail1@example.com'))

    def test_cant_remove_primary_email(self):
        response = self.client.delete(self.url, data={
            'email': 'foo@example.com',
        })
        assert response.status_code == 400
        assert len(UserEmail.objects.filter(user=self.user, email='foo@example.com'))

    def test_other_user_cant_change(self):
        other_user = self.create_user(email='other@example.com')
        self.login_as(user=other_user)

        # self.url represents users url to `self.user` and we are logged in as `other_user`
        response = self.client.post(self.url, data={
            'email': 'altemail1@example.com',
        })

        assert response.status_code == 403
