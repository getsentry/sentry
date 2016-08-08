from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import Organization
from sentry.testutils import APITestCase


class OrganizationsListTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-organizations')

    def test_membership(self):
        org = self.create_organization(owner=self.user)
        self.login_as(user=self.user)
        response = self.client.get('{}?member=1'.format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(org.id)


class OrganizationsCreateTest(APITestCase):
    @fixture
    def path(self):
        return reverse('sentry-api-0-organizations')

    def test_missing_params(self):
        self.login_as(user=self.user)
        resp = self.client.post(self.path)
        assert resp.status_code == 400

    def test_valid_params(self):
        self.login_as(user=self.user)

        resp = self.client.post(self.path, data={
            'name': 'hello world',
            'slug': 'foobar',
        })
        assert resp.status_code == 201, resp.content
        org = Organization.objects.get(id=resp.data['id'])
        assert org.name == 'hello world'
        assert org.slug == 'foobar'

        resp = self.client.post(self.path, data={
            'name': 'hello world',
            'slug': 'foobar',
        })
        assert resp.status_code == 409, resp.content

    def test_without_slug(self):
        self.login_as(user=self.user)

        resp = self.client.post(self.path, data={
            'name': 'hello world',
        })
        assert resp.status_code == 201, resp.content
        org = Organization.objects.get(id=resp.data['id'])
        assert org.slug == 'hello-world'
