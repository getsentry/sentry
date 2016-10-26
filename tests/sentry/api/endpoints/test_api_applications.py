from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import ApiApplication
from sentry.testutils import APITestCase


class ApiApplicationsListTest(APITestCase):
    def test_simple(self):
        app1 = ApiApplication.objects.create(
            owner=self.user,
            name='a',
        )
        app2 = ApiApplication.objects.create(
            owner=self.user,
            name='b',
        )
        ApiApplication.objects.create(
            owner=self.create_user('foo@example.com'),
        )

        self.login_as(self.user)
        url = reverse('sentry-api-0-api-applications')
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]['id'] == six.text_type(app1.id)
        assert response.data[1]['id'] == six.text_type(app2.id)


class ApiApplicationsCreateTest(APITestCase):
    def test_simple(self):
        self.login_as(self.user)
        url = reverse('sentry-api-0-api-applications')
        response = self.client.post(url, data={})
        assert response.status_code == 201
        assert ApiApplication.objects.get(
            id=response.data['id'],
            owner=self.user,
        )
