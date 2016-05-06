from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import UserAvatar
from sentry.testutils import APITestCase


class UserAvatarTest(APITestCase):
    def test_get(self):
        user = self.create_user(email='a@example.com')
        avatar = UserAvatar.objects.create(user=user)

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-avatar', kwargs={
            'user_id': 'me',
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(user.id)
        assert response.data['avatar']['avatarType'] == 'letter_avatar'
        assert response.data['avatar']['avatar_uuid'] == avatar.ident

    def test_put(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-avatar', kwargs={
            'user_id': 'me',
        })
        response = self.client.put(url, data={'avatar_type': 'gravatar'}, format='json')

        avatar = UserAvatar.objects.get(user=user)
        assert response.status_code == 200, response.content
        assert avatar.avatar_type == 'gravatar'

    def test_put_bad(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-avatar', kwargs={
            'user_id': 'me',
        })
        response = self.client.put(url, data={'avatar_type': 'upload'}, format='json')

        avatar = UserAvatar.objects.get(user=user)
        assert response.status_code == 400
        assert avatar.avatar_type == 'letter_avatar'

    def test_put_forbidden(self):
        user = self.create_user(email='a@example.com')
        user2 = self.create_user(email='b@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-avatar', kwargs={
            'user_id': user2.id,
        })
        response = self.client.put(url, data={'avatar_type': 'gravatar'}, format='json')

        assert response.status_code == 403
