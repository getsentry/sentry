from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationAccessRequest
from sentry.testutils import APITestCase


class UpdateOrganizationAccessRequestTest(APITestCase):
    def test_owner_can_list_access_requests(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        user = self.create_user('bar@example.com')
        member = self.create_member(
            organization=organization,
            user=user,
            role='member',
        )
        team = self.create_team(name='foo', organization=organization)

        OrganizationAccessRequest.objects.create(
            member=member,
            team=team,
        )

        path = reverse(
            'sentry-api-0-organization-access-requests',
            args=[organization.slug]
        )

        resp = self.client.get(path)

        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]['member']['email'] == 'bar@example.com'

    def test_member_empty_results(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name='foo', owner=self.user)
        user = self.create_user('bar@example.com')
        member = self.create_member(
            organization=organization,
            user=user,
            role='member',
        )
        team = self.create_team(name='foo', organization=organization)

        OrganizationAccessRequest.objects.create(
            member=member,
            team=team,
        )

        user = self.create_user('foo@example.com')
        member = self.create_member(
            organization=organization,
            user=user,
            role='member',
        )

        path = reverse(
            'sentry-api-0-organization-access-requests',
            args=[organization.slug]
        )

        self.login_as(user=user)
        resp = self.client.get(path)

        assert resp.status_code == 200
        assert len(resp.data) == 0
