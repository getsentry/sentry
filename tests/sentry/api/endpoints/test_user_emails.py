from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry import newsletter
from sentry.models import User, UserEmail
from sentry.testutils import APITestCase


class UserEmailsTest(APITestCase):
    def setUp(self):
        super(UserEmailsTest, self).setUp()

        def disable_newsletter():
            newsletter.backend.disable()

        # disable newsletter by default
        newsletter.backend.disable()

        self.addCleanup(disable_newsletter)
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

    def test_add_secondary_email(self):
        # test invalid email
        response = self.client.post(self.url, data={
            'email': 'invalidemail',
        })
        assert response.status_code == 400
        assert not UserEmail.objects.filter(user=self.user, email='invalidemail').exists()

        # valid secondary email
        response = self.client.post(self.url, data={
            'email': 'altemail1@example.com',
        })

        assert response.status_code == 201
        assert UserEmail.objects.filter(user=self.user, email='altemail1@example.com').exists()

        # duplicate email
        response = self.client.post(self.url, data={
            'email': 'altemail1@example.com',
        })
        assert response.status_code == 400

    def test_add_secondary_email_with_newsletter_subscribe(self):
        newsletter.backend.enable()
        response = self.client.post(self.url, data={
            'email': 'altemail1@example.com',
            'newsletter': '1',
        })

        assert response.status_code == 201
        assert UserEmail.objects.filter(user=self.user, email='altemail1@example.com').exists()
        results = newsletter.get_subscriptions(self.user)['subscriptions']
        assert len(results) == 1
        assert results[0].list_id == newsletter.get_default_list_id()
        assert results[0].subscribed
        assert not results[0].verified

    def test_add_secondary_email_with_newsletter_no_subscribe(self):
        newsletter.backend.enable()
        response = self.client.post(self.url, data={
            'email': 'altemail1@example.com',
            'newsletter': '0',
        })

        assert response.status_code == 201
        assert UserEmail.objects.filter(user=self.user, email='altemail1@example.com').exists()
        assert newsletter.get_subscriptions(self.user) == {'subscriptions': []}

    def test_change_verified_secondary_to_primary(self):
        UserEmail.objects.create(user=self.user, email='altemail1@example.com', is_verified=True)
        response = self.client.put(self.url, data={
            'email': 'altemail1@example.com',
        })
        assert response.status_code == 200

        user = User.objects.get(id=self.user.id)
        assert user.email == 'altemail1@example.com'
        assert user.username == 'altemail1@example.com'

    def test_change_unverified_secondary_to_primary(self):
        UserEmail.objects.create(user=self.user, email='altemail1@example.com', is_verified=False)
        response = self.client.put(self.url, data={
            'email': 'altemail1@example.com',
        })
        assert response.status_code == 400

        user = User.objects.get(id=self.user.id)
        assert user.email != 'altemail1@example.com'
        assert user.username != 'altemail1@example.com'

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
