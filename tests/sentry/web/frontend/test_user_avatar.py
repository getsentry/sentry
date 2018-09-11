from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.models import UserAvatar
from sentry.testutils import TestCase, TransactionTestCase
from sentry.web.frontend.generic import FOREVER_CACHE


class UserAvatarTest(TestCase):
    def test_headers(self):
        user = self.create_user(email='a@example.com')

        image_file = self.load_fixture('avatar.jpg')
        avatar = UserAvatar.save_avatar(
            relation={'user': user},
            type='upload',
            avatar=image_file,
            filename='test.png'
        )
        url = reverse('sentry-user-avatar-url', kwargs={'avatar_id': avatar.ident})
        response = self.client.get(url)

        assert response.status_code == 200
        assert response['Cache-Control'] == FOREVER_CACHE
        assert response.get('Vary') is None
        assert response.get('Set-Cookie') is None


class UserAvatarMeTest(TransactionTestCase):
    def test_get_unauthenticated(self):
        response = self.client.get('/avatar/me/')
        assert response.status_code == 404

    def test_get_letter_avatar(self):
        user = self.create_user(email='b@example.com')
        UserAvatar.save_avatar(
            relation={'user': user},
            type='letter_avatar'
        )

        self.login_as(user)
        response = self.client.get('/avatar/me/')

        assert response.status_code == 200
        assert 'image/svg+xml' in response['content-type']

    def test_get_photo_avatar(self):
        image_file = self.load_fixture('avatar.jpg')
        user = self.create_user(email='c@example.com')
        UserAvatar.save_avatar(
            relation={'user': user},
            type='upload',
            avatar=image_file,
            filename='test.png'
        )

        self.login_as(user)
        response = self.client.get('/avatar/me/')

        assert response.status_code == 200
        assert 'image/png' in response['content-type']
        assert response.content

    def test_get_photo_avatar_sized(self):
        image_file = self.load_fixture('avatar.jpg')
        user = self.create_user(email='c@example.com')
        UserAvatar.save_avatar(
            relation={'user': user},
            type='upload',
            avatar=image_file,
            filename='test.png'
        )

        self.login_as(user)
        response = self.client.get('/avatar/me/?s=96')

        assert response.status_code == 200
        assert 'image/png' in response['content-type']
        assert response.content

    def test_get_gravatar(self):
        user = self.create_user(email='d@example.com')
        UserAvatar.save_avatar(
            relation={'user': user},
            type='gravatar',
        )
        self.login_as(user)
        response = self.client.get('/avatar/me/')

        assert response.status_code == 302
        assert 'gravatar.com' in response['location']

    def test_get_gravatar_sized(self):
        user = self.create_user(email='d@example.com')
        UserAvatar.save_avatar(
            relation={'user': user},
            type='gravatar',
        )
        self.login_as(user)
        response = self.client.get('/avatar/me/?s=96')

        assert response.status_code == 302
        assert 'gravatar.com' in response['location']
        assert 's=96' in response['location']
