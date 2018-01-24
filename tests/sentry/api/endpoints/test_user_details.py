from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from django.conf import settings

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
        self.user = self.create_user(email='a@example.com', name='example name')
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
                'username': 'b@example.com',
                'options': {
                    'seenReleaseBroadcast': True
                }
            }
        )
        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.name == 'hello world'
        assert user.email == 'b@example.com'
        assert user.username == user.email
        assert UserOption.objects.get_value(
            user=user,
            key='seen_release_broadcast',
        ) is True

    def test_superuser(self):
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
                'username': 'foo',
                'isActive': 'false',
            }
        )
        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == six.text_type(self.user.id)

        user = User.objects.get(id=self.user.id)
        assert user.name == 'hello world'
        assert user.email == 'c@example.com'
        assert user.username == 'foo'
        assert not user.is_active

    def test_duplicate_username(self):
        self.create_user(email='dupe@example.com')

        resp = self.client.put(
            self.url,
            data={
                'username': 'dupe@example.com',
            }
        )
        assert resp.status_code == 400

        user = User.objects.get(id=self.user.id)
        assert user.username == 'a@example.com'

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

            user = User.objects.get(id=self.user.id)
            assert user.name == 'example name'

    def test_verifies_mismatch_password(self):
        # Password mismatch
        response = self.client.put(self.url, data={
            'password': 'testpassword',
            'passwordVerify': 'passworddoesntmatch',
        })
        assert response.status_code == 400

    def test_change_privileged_and_unprivileged(self):
        user = User.objects.get(id=self.user.id)
        old_password = user.password

        response = self.client.put(self.url, data={
            'password': 'newpassword',
            'passwordVerify': 'newpassword',
            'name': 'new name',
        })
        assert response.status_code == 200

        user = User.objects.get(id=self.user.id)
        assert user.password != old_password
        assert user.name == 'new name'


class UserSudoUpdateTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='a@example.com')
        self.login_as(user=self.user)

        self.url = reverse(
            'sentry-api-0-user-details', kwargs={
                'user_id': self.user.id,
            }
        )

        middleware = list(settings.MIDDLEWARE_CLASSES)
        index = middleware.index('sentry.testutils.middleware.SudoMiddleware')
        middleware[index] = 'sentry.middleware.sudo.SudoMiddleware'
        self.sudo_middleware = tuple(middleware)

        self.sudo_url = reverse('sentry-api-0-sudo', kwargs={})

    def test_change_password_requires_sudo(self):
        user = User.objects.get(id=self.user.id)
        old_password = user.password
        with self.settings(MIDDLEWARE_CLASSES=tuple(self.sudo_middleware)):
            response = self.client.put(self.url, data={
                'password': 'testpassword',
                'passwordVerify': 'testpassword',
            })

            assert response.status_code == 401
            assert response.data['sudoRequired']

            # Now try to gain sudo access
            response = self.client.post(self.sudo_url, {
                'username': 'foo@example.com',
                'password': 'admin',
            })
            assert response.status_code == 204

            # correct password change
            response = self.client.put(self.url, data={
                'password': 'testpassword',
                'passwordVerify': 'testpassword',
            })
            assert response.status_code == 200
            user = User.objects.get(id=self.user.id)
            assert user.password != old_password

    def test_change_email_requires_sudo(self):
        with self.settings(MIDDLEWARE_CLASSES=tuple(self.sudo_middleware)):
            response = self.client.put(self.url, data={
                'email': 'new@example.com',
            })

            assert response.status_code == 401
            assert response.data['sudoRequired']

            # Now try to gain sudo access
            response = self.client.post(self.sudo_url, {
                'username': 'foo@example.com',
                'password': 'admin',
            })
            assert response.status_code == 204

            response = self.client.put(self.url, data={
                'email': 'new@example.com',
            })
            assert response.status_code == 200
            user = User.objects.get(id=self.user.id)
            assert user.email == 'new@example.com'

    def test_change_username_requires_sudo(self):
        with self.settings(MIDDLEWARE_CLASSES=tuple(self.sudo_middleware)):
            response = self.client.put(self.url, data={
                'username': 'new@example.com',
            })

            assert response.status_code == 401
            assert response.data['sudoRequired']

            # Now try to gain sudo access
            response = self.client.post(self.sudo_url, {
                'email': 'foo@example.com',
                'password': 'admin',
            })
            assert response.status_code == 204

            response = self.client.put(self.url, data={
                'username': 'new@example.com',
            })
            assert response.status_code == 200
            user = User.objects.get(id=self.user.id)
            assert user.username == 'new@example.com'
            assert user.email == 'new@example.com'
