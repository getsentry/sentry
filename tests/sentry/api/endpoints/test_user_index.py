from __future__ import absolute_import

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.testutils import APITestCase


class UserListTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-user-index')

    def test_superuser_only(self):
        user = self.create_user('foo@example.com')
        self.login_as(user)
        response = self.client.get(self.path)
        assert response.status_code == 403

    def test_simple(self):
        self.login_as(user=self.user)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) >= 1
