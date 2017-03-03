from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import EventUser
from sentry.testutils import APITestCase


class ProjectUsersTest(APITestCase):
    def setUp(self):
        super(ProjectUsersTest, self).setUp()

        self.project = self.create_project()
        self.euser1 = EventUser.objects.create(
            project=self.project,
            ident='1',
            email='foo@example.com',
            username='foobar',
            ip_address='127.0.0.1',
        )

        self.euser2 = EventUser.objects.create(
            project=self.project,
            ident='2',
            email='bar@example.com',
            username='baz',
            ip_address='192.168.0.1',
        )

        self.path = reverse('sentry-api-0-project-users', kwargs={
            'organization_slug': self.project.organization.slug,
            'project_slug': self.project.slug,
        })

    def test_simple(self):
        self.login_as(user=self.user)

        response = self.client.get(self.path, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert sorted(map(lambda x: x['id'], response.data)) == sorted([
            six.text_type(self.euser1.id),
            six.text_type(self.euser2.id),
        ])

    def test_empty_search_query(self):
        self.login_as(user=self.user)

        response = self.client.get('{}?query=foo'.format(self.path), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_username_search(self):
        self.login_as(user=self.user)

        response = self.client.get('{}?query=username:baz'.format(self.path), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(self.euser2.id)

        response = self.client.get('{}?query=username:ba'.format(self.path), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

    def test_email_search(self):
        self.login_as(user=self.user)

        response = self.client.get('{}?query=email:foo@example.com'.format(self.path), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(self.euser1.id)

        response = self.client.get('{}?query=email:@example.com'.format(self.path), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2

    def test_id_search(self):
        self.login_as(user=self.user)

        response = self.client.get('{}?query=id:1'.format(self.path), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(self.euser1.id)

        response = self.client.get('{}?query=id:3'.format(self.path), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 0

    def test_ip_search(self):
        self.login_as(user=self.user)

        response = self.client.get('{}?query=ip:192.168.0.1'.format(self.path), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(self.euser2.id)

        response = self.client.get('{}?query=ip:0'.format(self.path), format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
