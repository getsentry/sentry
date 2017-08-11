from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class OrganizationMemberListTest(APITestCase):
    def setUp(self):
        self.user_1 = self.create_user('foo@localhost', username='foo')
        self.user_2 = self.create_user('bar@localhost', username='bar')
        self.create_user('baz@localhost', username='baz')

        self.org = self.create_organization(owner=self.user_1)
        self.org.member_set.create(user=self.user_2)

        self.login_as(user=self.user_1)

        self.url = reverse(
            'sentry-api-0-organization-member-index', kwargs={
                'organization_slug': self.org.slug,
            }
        )

    def test_simple(self):
        response = self.client.get(self.url)

        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['email'] == self.user_2.email
        assert response.data[1]['email'] == self.user_1.email

    def test_email_query(self):
        response = self.client.get(self.url + "?query=email:foo@localhost")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['email'] == self.user_1.email

    def test_user_email_email_query(self):
        self.create_useremail(self.user_1, 'baz@localhost')
        response = self.client.get(self.url + "?query=email:baz@localhost")

        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]['email'] == self.user_1.email
