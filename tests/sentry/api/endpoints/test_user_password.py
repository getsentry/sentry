from __future__ import absolute_import

import mock

from django.core.urlresolvers import reverse
from django.conf import settings

from sentry.models import User
from sentry.testutils import APITestCase
from sentry.auth.password_validation import MinimumLengthValidator


class UserPasswordTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(
            email='a@example.com',
            is_managed=False,
            name='example name',
        )
        self.user.set_password('helloworld!')
        self.user.save()

        self.login_as(user=self.user)
        self.url = reverse(
            'sentry-api-0-user-password', kwargs={
                'user_id': 'me',
            }
        )

    def test_change_password(self):
        old_password = self.user.password
        response = self.client.put(self.url, data={
            'password': 'helloworld!',
            'passwordNew': 'testpassword',
            'passwordVerify': 'testpassword',
        })
        user = User.objects.get(id=self.user.id)
        assert response.status_code == 204
        assert old_password != user.password

    # Not sure why but sentry.auth.password_validation._default_password_validators is [] instead of None and not
    # using `settings.AUTH_PASSWORD_VALIDATORS`
    @mock.patch('sentry.auth.password_validation.get_default_password_validators', mock.Mock(return_value=[
        MinimumLengthValidator(min_length=6)
    ]))
    def test_password_too_short(self):
        response = self.client.put(self.url, data={
            'password': 'helloworld!',
            'passwordNew': 'hi',
            'passwordVerify': 'hi',
        })
        assert response.status_code == 400

    def test_no_password(self):
        response = self.client.put(self.url, data={
            'password': 'helloworld!',
        })
        assert response.status_code == 400

        response = self.client.put(self.url, data={
        })
        assert response.status_code == 400

    def test_require_current_password(self):
        response = self.client.put(self.url, data={
            'password': 'wrongpassword',
            'passwordNew': 'testpassword',
            'passwordVerify': 'passworddoesntmatch',
        })
        assert response.status_code == 400

    def test_verifies_mismatch_password(self):
        # Password mismatch
        response = self.client.put(self.url, data={
            'password': 'helloworld!',
            'passwordNew': 'testpassword',
            'passwordVerify': 'passworddoesntmatch',
        })
        assert response.status_code == 400

    def test_managed_unable_change_password(self):
        user = self.create_user(email='new@example.com', is_managed=True)
        self.login_as(user)
        url = reverse(
            'sentry-api-0-user-password', kwargs={
                'user_id': user.id,
            }
        )

        response = self.client.put(url, data={
            'passwordNew': 'newpassword',
            'passwordVerify': 'newpassword',
        })
        assert response.status_code == 400

    def test_unusable_password_unable_change_password(self):
        user = self.create_user(email='new@example.com')
        user.set_unusable_password()
        user.save()
        self.login_as(user)

        url = reverse(
            'sentry-api-0-user-password', kwargs={
                'user_id': user.id,
            }
        )

        response = self.client.put(url, data={
            'passwordNew': 'newpassword',
            'passwordVerify': 'newpassword',
        })
        assert response.status_code == 400


class UserSudoUpdateTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='a@example.com')
        self.user.save()
        self.login_as(user=self.user)

        self.url = reverse(
            'sentry-api-0-user-password', kwargs={
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
                'password': 'admin',
                'passwordNew': 'testpassword',
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
                'password': 'admin',
                'passwordNew': 'testpassword',
                'passwordVerify': 'testpassword',
            })
            assert response.status_code == 204
            user = User.objects.get(id=self.user.id)
            assert user.password != old_password
