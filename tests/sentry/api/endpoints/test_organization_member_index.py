from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class OrganizationMemberListTest(APITestCase):
    def test_simple(self):
        user_1 = self.create_user('foo@localhost', username='foo')
        user_2 = self.create_user('bar@localhost', username='bar')
        self.create_user('baz@localhost', username='baz')

        org = self.create_organization(owner=user_1)
        org.member_set.create(user=user_2)

        self.login_as(user=user_1)

        url = reverse('sentry-api-0-organization-member-index', kwargs={
            'organization_slug': org.slug,
        })

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 2
        assert response.data[0]['email'] == user_2.email
        assert response.data[1]['email'] == user_1.email
