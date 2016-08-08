from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import UserAvatar
from sentry.testutils import APITestCase


class UserAvatarTest(APITestCase):
    def test_get(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-avatar', kwargs={
            'user_id': 'me',
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(user.id)
        assert response.data['avatar']['avatarType'] == 'letter_avatar'
        assert response.data['avatar']['avatarUuid'] is None

    def test_put(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-avatar', kwargs={
            'user_id': 'me',
        })
        response = self.client.put(url, data={'avatar_type': 'gravatar'}, format='json')

        avatar = UserAvatar.objects.get(user=user)
        assert response.status_code == 200, response.content
        assert avatar.get_avatar_type_display() == 'gravatar'

    def test_put_bad(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-avatar', kwargs={
            'user_id': 'me',
        })
        response = self.client.put(url, data={'avatar_type': 'upload'}, format='json')

        avatar = UserAvatar.objects.get(user=user)
        assert response.status_code == 400
        assert avatar.get_avatar_type_display() == 'letter_avatar'

        response = self.client.put(url, data={'avatar_type': 'foo'}, format='json')
        assert response.status_code == 400
        assert avatar.get_avatar_type_display() == 'letter_avatar'

    def test_put_forbidden(self):
        user = self.create_user(email='a@example.com')
        user2 = self.create_user(email='b@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-avatar', kwargs={
            'user_id': user2.id,
        })
        response = self.client.put(url, data={'avatar_type': 'gravatar'}, format='json')

        assert response.status_code == 403
