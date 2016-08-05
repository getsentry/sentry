from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import AuthIdentity, AuthProvider, User
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

        org = self.create_organization(owner=user)
        auth_provider = AuthProvider.objects.create(
            organization=org,
            provider='dummy',
        )
        auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider,
            ident=user.email,
            user=user,
        )

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-details', kwargs={
            'user_id': 'me',
        })
        resp = self.client.get(url, format='json')

        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(user.id)
        assert 'identities' in resp.data
        assert len(resp.data['identities']) == 1
        assert resp.data['identities'][0]['id'] == auth_identity.ident

    def test_superuser(self):
        user = self.create_user(email='a@example.com')
        superuser = self.create_user(email='b@example.com', is_superuser=True)

        self.login_as(user=superuser)

        url = reverse('sentry-api-0-user-details', kwargs={
            'user_id': user.id,
        })

        resp = self.client.get(url)
        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(user.id)
        assert 'identities' in resp.data
        assert len(resp.data['identities']) == 0


class UserUpdateTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-details', kwargs={
            'user_id': 'me',
        })

        resp = self.client.put(url, data={
            'name': 'hello world',
            'username': 'b@example.com',
        })
        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(user.id)

        user = User.objects.get(id=user.id)
        assert user.name == 'hello world'
        assert user.email == 'b@example.com'
        assert user.username == user.email

    def test_superuser(self):
        user = self.create_user(email='a@example.com')
        superuser = self.create_user(email='b@example.com', is_superuser=True)

        self.login_as(user=superuser)

        url = reverse('sentry-api-0-user-details', kwargs={
            'user_id': user.id,
        })

        resp = self.client.put(url, data={
            'name': 'hello world',
            'email': 'c@example.com',
            'username': 'foo',
            'isActive': 'false',
        })
        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(user.id)

        user = User.objects.get(id=user.id)
        assert user.name == 'hello world'
        assert user.email == 'c@example.com'
        assert user.username == 'foo'
        assert not user.is_active
