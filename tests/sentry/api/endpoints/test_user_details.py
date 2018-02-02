from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import User, UserOption
from sentry.testutils import APITestCase


class UserDetailsTest(APITestCase):
    # TODO(dcramer): theres currently no way to look up other users
    # def test_simple(self):
    #     user = self.create_user(email='a@example.com')
    #     user2 = self.create_user(email='b@example.com')

    #     self.login_as(user=user)

    #     url = reverse('sentry-api-0-user-details', kwargs={
    #         'user_id': user2.id,
    #     })
    #     resp = self.client.get(url, format='json')

    #     assert resp.status_code == 200, resp.content
    #     assert resp.data['id'] == six.text_type(user.id)
    #     assert 'identities' not in resp.data

    def test_lookup_self(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse(
            'sentry-api-0-user-details', kwargs={
                'user_id': 'me',
            }
        )
        resp = self.client.get(url, format='json')

        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(user.id)
        assert resp.data['options']['timezone'] == 'UTC'
        assert resp.data['options']['language'] == 'en'
        assert resp.data['options']['stacktraceOrder'] == -1
        assert not resp.data['options']['clock24Hours']

    def test_superuser(self):
        user = self.create_user(email='a@example.com')
        superuser = self.create_user(email='b@example.com', is_superuser=True)

        self.login_as(user=superuser, superuser=True)

        url = reverse(
            'sentry-api-0-user-details', kwargs={
                'user_id': user.id,
            }
        )

        resp = self.client.get(url)
        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(user.id)
        assert 'identities' in resp.data
        assert len(resp.data['identities']) == 0


class UserUpdateTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='a@example.com', is_managed=False, name='example name')
        self.login_as(user=self.user)
        self.url = reverse(
            'sentry-api-0-user-details', kwargs={
                'user_id': 'me',
            }
        )

    def test_simple(self):
        resp = self.client.put(
            self.url,
            data={
                'name': 'hello world',
                'options': {
                    'timezone': 'UTC',
                    'stacktraceOrder': '2',
                    'language': 'fr',
                    'clock24Hours': True,
                    'extra': True,
                    'seenReleaseBroadcast': True,
                }
            }
        )
        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.name == 'hello world'
        # note: email should not change, removed support for email changing from this endpoint
        assert user.email == 'a@example.com'
        assert user.username == 'a@example.com'
        assert UserOption.objects.get_value(
            user=user,
            key='seen_release_broadcast',
        ) is True
        assert UserOption.objects.get_value(user=self.user, key='timezone') == 'UTC'
        assert UserOption.objects.get_value(user=self.user, key='stacktrace_order') == '2'
        assert UserOption.objects.get_value(user=self.user, key='language') == 'fr'
        assert UserOption.objects.get_value(user=self.user, key='clock_24_hours')
        assert not UserOption.objects.get_value(user=self.user, key='extra')

    def test_superuser(self):
        # superuser should be able to change self.user's name
        superuser = self.create_user(email='b@example.com', is_superuser=True)
        self.login_as(user=superuser, superuser=True)

        url = reverse(
            'sentry-api-0-user-details', kwargs={
                'user_id': self.user.id,
            }
        )

        resp = self.client.put(
            url,
            data={
                'name': 'hello world',
                'email': 'c@example.com',
                'isActive': 'false',
            }
        )
        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.name == 'hello world'
        # note: email should not change, removed support for email changing from this endpoint
        assert user.email == 'a@example.com'
        assert user.username == 'a@example.com'
        assert not user.is_active

    def test_managed_fields(self):
        assert self.user.name == 'example name'
        with self.settings(SENTRY_MANAGED_USER_FIELDS=('name', )):
            resp = self.client.put(
                self.url,
                data={
                    'name': 'new name',
                }
            )
            assert resp.status_code == 200

            # name remains unchanged
            user = User.objects.get(id=self.user.id)
            assert user

    def test_change_username_when_different(self):
        # if email != username and we change username, only username should change
        user = self.create_user(email="c@example.com", username="diff@example.com")
        self.login_as(user=user, superuser=False)

        resp = self.client.put(
            self.url,
            data={
                'username': 'new@example.com',
            }
        )
        assert resp.status_code == 200, resp.content

        user = User.objects.get(id=user.id)

        assert user.email == 'c@example.com'
        assert user.username == 'new@example.com'

    def test_change_username_when_same(self):
        # if email == username and we change username,
        # keep email in sync
        user = self.create_user(email="c@example.com", username="c@example.com")
        self.login_as(user=user)

        resp = self.client.put(
            self.url,
            data={
                'username': 'new@example.com',
            }
        )
        assert resp.status_code == 200, resp.content

        user = User.objects.get(id=user.id)

        assert user.email == 'new@example.com'
        assert user.username == 'new@example.com'
